import db from '../config/db';

async function runMigration() {
  console.log('🚀 Starting Database Schema Migration...');
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Adding latitude and longitude to branches table (if not exists)...');
    await client.query(`
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
    `);

    console.log('Adding training_type to trainings table (if not exists)...');
    await client.query(`
      ALTER TABLE trainings ADD COLUMN IF NOT EXISTS training_type VARCHAR(10) DEFAULT 'online';
    `);

    await client.query('COMMIT');
    console.log('✅ Database migration successfully completed!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();
