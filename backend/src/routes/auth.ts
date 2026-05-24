import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validate } from '../middleware/validate';
import { LoginSchema, RegisterSchema } from '../middleware/schemas';
import { authenticateToken, requireManager } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// POST /api/v1/auth/login
// Public endpoint for employees/managers, protected by authentication brute-force rate limiting
router.post(
  '/login',
  authRateLimiter,
  validate({ body: LoginSchema }),
  AuthController.login
);

// POST /api/v1/auth/register
// Restricted endpoint allowing managers to register new employee records
router.post(
  '/register',
  authenticateToken as any,
  requireManager as any,
  validate({ body: RegisterSchema }),
  AuthController.register as any
);

export default router;
