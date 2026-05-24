import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables before validation
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('8080' as any),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string').optional(),
  
  // Standard PostgreSQL fallback variables (if DATABASE_URL is not set)
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform((val) => parseInt(val, 10)).default('5432' as any),
  DB_USER: z.string().default('axis_db_user'),
  DB_PASSWORD: z.string().default('axis_db_password'),
  DB_NAME: z.string().default('axis_training_calendar'),
}).refine((data) => {
  // Enforce that in production, DATABASE_URL must be set, OR DB_HOST/DB_USER/DB_PASSWORD must not be local defaults
  if (data.NODE_ENV === 'production' && !data.DATABASE_URL) {
    if (data.DB_HOST === 'localhost' || data.DB_USER === 'axis_db_user') {
      return false;
    }
  }
  return true;
}, {
  message: 'In production mode, a valid cloud DATABASE_URL must be supplied, or secure non-default DB variables configured.',
  path: ['DATABASE_URL'],
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment validation failed. Critical startup configuration errors detected:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
export type EnvType = z.infer<typeof envSchema>;
