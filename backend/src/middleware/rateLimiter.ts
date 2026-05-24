import rateLimit from 'express-rate-limit';
import { AppError } from './errors';

// Global API rate limiter: Max 300 requests per 5 minutes per IP
export const globalRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 300,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next) => {
    next(new AppError('Too many requests, please try again later.', 429, 'TOO_MANY_REQUESTS'));
  },
});

// Authentication rate limiter: Max 10 attempts per 15 minutes per IP
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new AppError('Too many authentication attempts. Please wait 15 minutes before trying again.', 429, 'AUTH_BRUTE_FORCE_PREVENTION'));
  },
});
