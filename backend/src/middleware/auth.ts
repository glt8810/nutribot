import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';

export interface AuthRequest extends Request {
  userId?: string;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const payload = await verifyAccessToken(token);

    if (!payload.uid) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.userId = payload.uid;
    next();
  } catch (err: any) {
    if (err.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}
