import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

let host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '5432', 10);

const dbConfig: PoolConfig = {
  user: process.env.DB_USER || 'axis_db_user',
  password: process.env.DB_PASSWORD || 'axis_db_password',
  host,
  port,
  database: process.env.DB_NAME || 'axis_training_calendar',
  
  // Connection Pool Tuning parameters
  max: 20,                  // Max number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Timeout connecting to the server
};

const poolConfig: PoolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : dbConfig;

// Add SSL configurations if deploying in cloud production environments (e.g., GCP Cloud SQL via IP or Neon.tech)
if (process.env.DATABASE_URL) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
} else if (host.startsWith('/') || host.startsWith('/cloudsql/')) {
  poolConfig.ssl = false; // Unix domain sockets do not support SSL
} else if (process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true') {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(poolConfig);

// Database Pool event listeners
pool.on('connect', () => {
  console.log('Successfully connected database client to PostgreSQL pool');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

export default {
  query: (text: string, params?: any[]) => pool.query(text, params),
  pool,
};
