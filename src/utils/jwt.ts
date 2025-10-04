import jwt from 'jsonwebtoken';

export const generateToken = (userId: number): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '24h' });
};

export const verifyToken = (token: string): { userId: number } => {
  return jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
};
