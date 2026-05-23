import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import trainingRoutes from './routes/trainings';
import reportsRoutes from './routes/reports';
import db from './config/db';

// Load environment variables
dotenv.config();

const app = express();

// Set port - Cloud Run dynamically overrides PORT and expects the server to listen on it
const PORT = process.env.PORT || '8080';

// Global Middlewares
app.use(cors());
app.use(express.json());

// Base Health Check Route (Essential for GCP Cloud Run liveness/readiness probes)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Axis Bank Training Calendar & Management API Gateway',
    version: '1.0.0'
  });
});

// Mounted Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/trainings', trainingRoutes);
app.use('/api/v1/reports', reportsRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error: Something went wrong inside the API Gateway.'
  });
});

// Boot Server
const server = app.listen(parseInt(PORT, 10), '0.0.0.0', () => {
  console.log(`📡 Axis Bank backend successfully listening on network interface 0.0.0.0:${PORT}`);
});

// Graceful Shutdown Handler (CRITICAL for containerized cloud deployment models like GCP Cloud Run)
const handleGracefulShutdown = () => {
  console.log('🛑 Termination signal received. Initiating graceful shutdown...');
  
  server.close(async () => {
    console.log('🔒 Express HTTP server closed.');
    
    try {
      await db.pool.end();
      console.log('🔌 Database pool connections closed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('⚠️ Error closing database connections during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', handleGracefulShutdown);
process.on('SIGINT', handleGracefulShutdown);
