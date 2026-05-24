import db from '../config/db';
import { logger } from '../config/logger';

async function runMigrations() {
  logger.info('🚀 Database schema migration sequence started...');
  
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Execute DDL operations safely
    logger.info('Applying branches GPS coordinates columns...');
    await client.query(`
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    `);
    
    logger.info('Applying trainings training_type columns...');
    await client.query(`
      ALTER TABLE trainings ADD COLUMN IF NOT EXISTS training_type VARCHAR(10) DEFAULT 'online';
    `);
    
    await client.query('COMMIT');
    logger.info('✅ Database schema migrations executed and committed successfully!');
    process.exit(0);
  } catch (err: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Database schema migrations sequence failed! Rollback executed.', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

runMigrations();
