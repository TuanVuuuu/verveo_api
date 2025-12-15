import { OAuth2Client } from 'google-auth-library';
import admin from 'firebase-admin';
import pool from '../config/database.js';
import { generateToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

interface GoogleTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
}

export const verifyGoogleToken = async (idToken: string): Promise<GoogleTokenPayload> => {
  try {
    // Không specify audience để accept token từ bất kỳ Client ID nào trong cùng Google project
    // (iOS, Android, Web application - tất cả đều trong cùng project)
    const ticket = await client.verifyIdToken({
      idToken,
      // audience: process.env.GOOGLE_CLIENT_ID, // Removed - accept từ bất kỳ Client ID nào
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken));
    }

    // Verify payload có hợp lệ không
    if (!payload.email || !payload.sub) {
      throw new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken));
    }

    return {
      sub: payload.sub,
      email: payload.email || '',
      email_verified: payload.email_verified || false,
      name: payload.name || '',
      picture: payload.picture,
    };
  } catch (error) {
    throw new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken));
  }
};

export const verifyFirebaseToken = async (idToken: string): Promise<GoogleTokenPayload> => {
  try {
    if (!admin.apps || admin.apps.length === 0) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);

    if (!decodedToken.email || !decodedToken.uid) {
      throw new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken));
    }

    return {
      sub: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified || false,
      name: decodedToken.name || decodedToken.email.split('@')[0],
      picture: decodedToken.picture,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken));
  }
};

export const verifyToken = async (idToken: string): Promise<GoogleTokenPayload> => {
  try {
    return await verifyGoogleToken(idToken);
  } catch (googleError) {
    try {
      return await verifyFirebaseToken(idToken);
    } catch (firebaseError) {
      throw new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken));
    }
  }
};

export const loginOrRegisterWithGoogle = async (idToken: string) => {
  const googleUser = await verifyToken(idToken);

  if (!googleUser.email_verified) {
    throw new AppError(ErrorKey.AuthEmailNotVerified, getErrorMessage(ErrorKey.AuthEmailNotVerified));
  }

  const [usersByGoogleId] = await pool.execute('SELECT * FROM users WHERE google_id = ?', [
    googleUser.sub,
  ]);

  if ((usersByGoogleId as any[]).length > 0) {
    // Đã có identity Google → login bình thường
    const user = (usersByGoogleId as any[])[0];
    const token = generateToken(user.id);
    return {
      state: 'OK_LOGIN',
      context: {
        user: { id: user.id, email: user.email, name: user.name },
        isNewUser: false,
      },
      actions: [],
      token,
    };
  }

  // Chưa có Google identity → kiểm tra xem email đã thuộc về user nào chưa
  const [usersByEmail] = await pool.execute('SELECT * FROM users WHERE email = ?', [
    googleUser.email,
  ]);

  if ((usersByEmail as any[]).length > 0) {
    // Email đã được dùng bởi 1 user khác → KHÔNG auto-link
    const user = (usersByEmail as any[])[0];

    const existingProviders: string[] = [];
    if (user.password_hash) existingProviders.push('password');
    if (user.google_id) existingProviders.push('google');
    if (user.apple_id) existingProviders.push('apple');

    return {
      state: 'NEED_USER_CONFIRM_LINK',
      context: {
        email: googleUser.email,
        existing_providers: existingProviders,
      },
      actions: [
        {
          type: 'REAUTH',
          allowed_methods: existingProviders,
        },
        {
          type: 'CANCEL',
        },
      ],
    };
  }

  // Không có user nào với email này → tạo account mới dùng Google
  const [result] = await pool.execute(
    'INSERT INTO users (email, name, google_id, auth_provider, is_verified, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
    [googleUser.email, googleUser.name, googleUser.sub, 'google', true, null]
  );

  const userId = (result as any).insertId;
  const token = generateToken(userId);

  return {
    state: 'OK_LOGIN',
    context: {
      user: { id: userId, email: googleUser.email, name: googleUser.name },
      isNewUser: true,
    },
    actions: [],
    token,
  };
};

/**
 * Link Google account cho user đã login (dùng trong Settings)
 */
export const linkGoogleAccount = async (userId: number, idToken: string) => {
  const googleUser = await verifyToken(idToken);

  if (!googleUser.email_verified) {
    throw new AppError(ErrorKey.AuthEmailNotVerified, getErrorMessage(ErrorKey.AuthEmailNotVerified));
  }

  // Kiểm tra xem Google sub này đã gắn với user khác chưa
  const [byGoogleId] = await pool.execute('SELECT id FROM users WHERE google_id = ?', [
    googleUser.sub,
  ]);

  if ((byGoogleId as any[]).length > 0) {
    const existing = (byGoogleId as any[])[0] as { id: number };
    if (existing.id !== userId) {
      // Google account này đã gắn với user khác
      throw new AppError(ErrorKey.AuthUserExists, getErrorMessage(ErrorKey.AuthUserExists));
    }
  }

  // Gắn google_id cho user hiện tại (nếu chưa có)
  await pool.execute(
    'UPDATE users SET google_id = ?, auth_provider = IF(auth_provider = \"email\", auth_provider, \"google\") WHERE id = ?',
    [googleUser.sub, userId]
  );

  const [users] = await pool.execute('SELECT id, email, name FROM users WHERE id = ?', [userId]);
  const user = (users as any[])[0];
  const token = generateToken(userId);

  return {
    state: 'OK_LOGIN',
    context: {
      user: { id: user.id, email: user.email, name: user.name },
      isNewUser: false,
    },
    actions: [],
    token,
  };
};

