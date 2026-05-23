import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'AxisSuperSecureBrandSecret2026Key!';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    employee_id: string;
    role: 'manager' | 'employee';
    branch_id: string;
    first_name: string;
    last_name: string;
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expecting 'Bearer TOKEN'

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authorization header token missing.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired authorization token.' });
    }
    
    req.user = decoded as AuthenticatedRequest['user'];
    next();
  });
}

export function requireManager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'manager') {
    return res.status(403).json({ 
      success: false, 
      error: 'Access Denied: Managers administrative credentials required for this endpoint.' 
    });
  }
  next();
}
