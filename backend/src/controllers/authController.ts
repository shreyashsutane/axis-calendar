import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../middleware/auth';

export class AuthController {
  public static async login(req: Request, res: Response, next: NextFunction) {
    const { email_or_id, password } = req.body;
    
    try {
      const data = await AuthService.login(email_or_id, password);
      
      return res.status(200).json({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      return next(err);
    }
  }

  public static async register(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const { employee_id, first_name, last_name, email, role, branch_id } = req.body;
    
    try {
      const data = await AuthService.register(
        employee_id,
        first_name,
        last_name,
        email,
        role,
        branch_id
      );
      
      return res.status(201).json({
        success: true,
        message: 'New employee registered successfully in Axis Bank Active Directory.',
        data,
      });
    } catch (err) {
      return next(err);
    }
  }
}
