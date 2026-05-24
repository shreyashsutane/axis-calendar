// Import environment variables first to trigger fail-fast validation on startup
import { env } from './config/env';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import trainingRoutes from './routes/trainings';
import reportsRoutes from './routes/reports';
import db from './config/db';
import { logger } from './config/logger';
import { globalRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errors';

const app = express();

// Global Middlewares
app.use(cors()); // In strict production, restrict origin array to trusted corporate domains
app.use(express.json());
app.use(globalRateLimiter); // Protect overall API resources from denial of service

// Base Health Check Route (Essential for GCP Cloud Run/Render liveness/readiness probes)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Axis Bank Training Calendar & Management API Gateway',
    version: '1.0.0',
  });
});

// Mounted Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/trainings', trainingRoutes);
app.use('/api/v1/reports', reportsRoutes);

// Centralized Enterprise Error Handler
app.use(errorHandler);

// Boot Server
const PORT = env.PORT;
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`📡 Axis Bank backend successfully listening on network interface 0.0.0.0:${PORT}`, {
    port: PORT,
    environment: env.NODE_ENV,
  });
});

// Graceful Shutdown Handler (CRITICAL for containerized cloud deployment models like GCP Cloud Run & Render)
const handleGracefulShutdown = () => {
  logger.info('🛑 Termination signal received. Initiating graceful shutdown...');
  
  server.close(async () => {
    logger.info('🔒 Express HTTP server closed.');
    
    try {
      await db.pool.end();
      logger.info('🔌 Database pool connections closed successfully.');
      process.exit(0);
    } catch (err) {
      logger.error('⚠️ Error closing database connections during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', handleGracefulShutdown);
process.on('SIGINT', handleGracefulShutdown);
export default app;
