import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import crypto from 'crypto';
import pool from '../config/database.js';
import { generateToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';
import { cancelAccountDeletion } from './accountDeletionService.js';
import { logger } from '../utils/logger.js';

// Apple's public key endpoint
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_AUDIENCE = process.env.APPLE_CLIENT_ID; // Bundle ID của iOS app

// JWKS client để lấy public keys từ Apple
const client = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

interface AppleTokenPayload {
  sub: string; // Apple User ID (unique, stable)
  email?: string; // Có thể không có nếu user chọn "Hide My Email"
  email_verified?: boolean;
  name?: string; // Chỉ có trong lần đầu tiên
  is_private_email?: boolean; // true nếu user chọn "Hide My Email"
}

// Lấy public key từ Apple để verify token
const getKey = (header: any, callback: any) => {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
};

/**
 * Hash nonce bằng SHA256 (giống iOS)
 * @param nonce - Raw nonce string
 * @returns SHA256 hash của nonce
 */
const sha256 = (nonce: string): string => {
  return crypto.createHash('sha256').update(nonce).digest('hex');
};

/**
 * Verify Apple ID token với nonce để chống replay attack
 * @param idToken - Apple ID token từ iOS app
 * @param rawNonce - Raw nonce string từ iOS app (để verify)
 * @returns Apple user information
 */
export const verifyAppleToken = async (idToken: string, rawNonce?: string): Promise<AppleTokenPayload> => {
  try {
    return new Promise((resolve, reject) => {
      jwt.verify(
        idToken,
        getKey,
        {
          audience: APPLE_AUDIENCE,
          issuer: APPLE_ISSUER,
          algorithms: ['RS256'],
        },
        (err, decoded: any) => {
          if (err) {
            reject(new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken)));
            return;
          }

          if (!decoded || !decoded.sub) {
            reject(new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken)));
            return;
          }

          // Verify nonce để chống replay attack
          if (rawNonce) {
            const hashedNonce = sha256(rawNonce);
            if (decoded.nonce !== hashedNonce) {
              reject(new AppError(ErrorKey.AuthInvalidToken, 'Invalid nonce - possible replay attack'));
              return;
            }
          } else {
            // Nếu không có nonce, log warning (nên có nonce để security tốt hơn)
            console.warn('⚠️ Apple Sign-In: No nonce provided - replay attack protection disabled');
          }

          // Apple có thể không trả về email nếu user chọn "Hide My Email"
          // Trong trường hợp đó, email sẽ là một private relay email từ Apple
          resolve({
            sub: decoded.sub,
            email: decoded.email,
            email_verified: decoded.email_verified || false,
            name: decoded.name, // Chỉ có trong lần đầu tiên
            is_private_email: decoded.email?.includes('privaterelay.appleid.com') || false,
          });
        }
      );
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken));
  }
};

/**
 * Login or register user with Apple Sign-In
 * 
 * ⚠️ QUAN TRỌNG: Apple KHÔNG tự động link với Email/Google dựa trên email
 * - Lý do: Apple có "Hide My Email" → email có thể là private relay, không đáng tin cậy
 * - Chỉ tìm user theo apple_id (nếu đã đăng nhập bằng Apple trước đó)
 * - Nếu không tìm thấy → tạo account mới (không tìm theo email để link)
 * 
 * @param idToken - Apple ID token từ iOS app
 * @param rawNonce - Raw nonce string để verify chống replay attack
 * @param userInfo - Optional user info (name, email) từ lần đầu đăng nhập
 * @returns JWT token và user info
 */
export const loginOrRegisterWithApple = async (
  idToken: string,
  rawNonce?: string,
  userInfo?: { name?: string; email?: string }
) => {
  const appleUser = await verifyAppleToken(idToken, rawNonce);

  // Bước 1: Tìm user theo apple_id (nếu đã đăng nhập bằng Apple trước đó)
  const [usersByAppleId] = await pool.execute('SELECT * FROM users WHERE apple_id = ?', [
    appleUser.sub,
  ]);

  if ((usersByAppleId as any[]).length > 0) {
    const user = (usersByAppleId as any[])[0];
    
    // Check if account is deleted
    if (user.is_deleted) {
      throw new AppError(ErrorKey.AuthInvalidCredentials, 'Account has been deleted');
    }
    
    // Cancel deletion if user has pending deletion request
    if (user.deletion_requested_at) {
      await cancelAccountDeletion(user.id);
      logger.info(`Account deletion cancelled for user ${user.id} due to Apple login`);
    }
    
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

  // Bước 2: Tạo user mới hoặc gợi ý link nếu email trùng (nhưng KHÔNG auto-link)
  // Lấy name từ userInfo (chỉ có trong lần đầu) hoặc từ token
  const userName = userInfo?.name || appleUser.name || 'Apple User';
  // Lấy email từ token hoặc userInfo, nếu không có thì dùng private relay email
  const userEmail =
    appleUser.email || userInfo?.email || `apple_${appleUser.sub}@privaterelay.appleid.com`;

  // ❗ QUAN TRỌNG: KHÔNG auto-link Apple với Email/Google
  // Nếu email này đã thuộc về một account khác (email/password hoặc Google),
  // không auto-merge, mà trả về state để user tự xác nhận
  const [existingByEmail] = await pool.execute('SELECT * FROM users WHERE email = ?', [
    userEmail,
  ]);

  if ((existingByEmail as any[]).length > 0) {
    const user = (existingByEmail as any[])[0];

    const existingProviders: string[] = [];
    if (user.password_hash) existingProviders.push('password');
    if (user.google_id) existingProviders.push('google');
    if (user.apple_id) existingProviders.push('apple');

    return {
      state: 'NEED_USER_CONFIRM_LINK',
      context: {
        email: userEmail,
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

  const [result] = await pool.execute(
    'INSERT INTO users (email, name, apple_id, auth_provider, is_verified, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
    [userEmail, userName, appleUser.sub, 'apple', true, null]
  );

  const userId = (result as any).insertId;
  const token = generateToken(userId);

  return {
    state: 'OK_LOGIN',
    context: {
      user: { id: userId, email: userEmail, name: userName },
      isNewUser: true,
    },
    actions: [],
    token,
  };
};

/**
 * Link Apple account cho user đã login (dùng trong Settings)
 */
export const linkAppleAccount = async (
  userId: number,
  idToken: string,
  rawNonce?: string,
  userInfo?: { name?: string; email?: string }
) => {
  const appleUser = await verifyAppleToken(idToken, rawNonce);

  // Kiểm tra xem Apple sub này đã gắn với user khác chưa
  const [byAppleId] = await pool.execute('SELECT id FROM users WHERE apple_id = ?', [
    appleUser.sub,
  ]);

  if ((byAppleId as any[]).length > 0) {
    const existing = (byAppleId as any[])[0] as { id: number };
    if (existing.id !== userId) {
      throw new AppError(ErrorKey.AuthUserExists, getErrorMessage(ErrorKey.AuthUserExists));
    }
  }

  // Gắn apple_id cho user hiện tại (nếu chưa có)
  await pool.execute(
    'UPDATE users SET apple_id = ?, auth_provider = IF(auth_provider = \"email\", auth_provider, \"apple\") WHERE id = ?',
    [appleUser.sub, userId]
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
