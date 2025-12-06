import { OAuth2Client } from 'google-auth-library';
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
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
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

export const loginOrRegisterWithGoogle = async (idToken: string) => {
  const googleUser = await verifyGoogleToken(idToken);

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

    await pool.execute(
      'UPDATE users SET google_id = ?, auth_provider = ? WHERE id = ?',
      [googleUser.sub, 'google', user.id]
    );

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

