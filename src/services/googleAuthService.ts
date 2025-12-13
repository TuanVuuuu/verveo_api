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
    const user = (usersByGoogleId as any[])[0];
    const token = generateToken(user.id);
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      isNewUser: false,
    };
  }

  const [usersByEmail] = await pool.execute('SELECT * FROM users WHERE email = ?', [
    googleUser.email,
  ]);

  if ((usersByEmail as any[]).length > 0) {
    const user = (usersByEmail as any[])[0];

    // Chỉ update google_id, không đổi auth_provider nếu user đã có password
    // Cho phép user dùng cả hai phương thức (email/password và Google)
    if (user.password_hash) {
      // User đã có password -> giữ auth_provider = 'email', chỉ thêm google_id
      await pool.execute('UPDATE users SET google_id = ? WHERE id = ?', [
        googleUser.sub,
        user.id,
      ]);
    } else {
      // User không có password -> set auth_provider = 'google'
      await pool.execute(
        'UPDATE users SET google_id = ?, auth_provider = ? WHERE id = ?',
        [googleUser.sub, 'google', user.id]
      );
    }

    const token = generateToken(user.id);
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      isNewUser: false,
    };
  }

  const [result] = await pool.execute(
    'INSERT INTO users (email, name, google_id, auth_provider, is_verified, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
    [googleUser.email, googleUser.name, googleUser.sub, 'google', true, null]
  );

  const userId = (result as any).insertId;
  const token = generateToken(userId);

  return {
    token,
    user: { id: userId, email: googleUser.email, name: googleUser.name },
    isNewUser: true,
  };
};

