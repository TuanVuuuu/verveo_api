import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import crypto from 'crypto';
import pool from '../config/database.js';
import { generateToken } from '../utils/jwt.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';

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
    const token = generateToken(user.id);
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      isNewUser: false,
    };
  }

  // Bước 2: ❌ KHÔNG tìm user theo email để auto-link
  // Apple không tự động link với Email/Google chỉ dựa trên email
  // Lý do: Apple có "Hide My Email" → email có thể là private relay email, không đáng tin cậy

  // Bước 3: Tạo user mới
  // Lấy name từ userInfo (chỉ có trong lần đầu) hoặc từ token
  const userName = userInfo?.name || appleUser.name || 'Apple User';
  // Lấy email từ token hoặc userInfo, nếu không có thì dùng private relay email
  const userEmail = appleUser.email || userInfo?.email || `apple_${appleUser.sub}@privaterelay.appleid.com`;

  const [result] = await pool.execute(
    'INSERT INTO users (email, name, apple_id, auth_provider, is_verified, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
    [userEmail, userName, appleUser.sub, 'apple', true, null]
  );

  const userId = (result as any).insertId;
  const token = generateToken(userId);

  return {
    token,
    user: { id: userId, email: userEmail, name: userName },
    isNewUser: true,
  };
};
