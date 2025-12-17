import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  console.log('🔄 Running database migration for Account Deletion...\n');

  if (!process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
    console.error('❌ Missing required environment variables:');
    console.error('   - DB_USER');
    console.error('   - DB_PASS');
    console.error('   - DB_NAME');
    console.error('\n💡 Please check your .env file');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    const migrationFile = join(process.cwd(), 'migrations', '004_add_account_deletion.sql');
    const sql = readFileSync(migrationFile, 'utf-8');

    console.log('📄 Reading migration file:', migrationFile);
    console.log('📝 SQL to execute:\n', sql, '\n');

    await connection.query(sql);
    console.log('✅ Migration completed successfully!');

    // Verify migration
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'deletion_requested_at'"
    );
    if ((columns as any[]).length > 0) {
      console.log('✅ Verified: deletion_requested_at column exists');
    } else {
      console.log('❌ Warning: deletion_requested_at column not found');
    }

    const [scheduledColumns] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'deletion_scheduled_at'"
    );
    if ((scheduledColumns as any[]).length > 0) {
      console.log('✅ Verified: deletion_scheduled_at column exists');
    } else {
      console.log('❌ Warning: deletion_scheduled_at column not found');
    }

    const [deletedColumns] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'is_deleted'"
    );
    if ((deletedColumns as any[]).length > 0) {
      console.log('✅ Verified: is_deleted column exists');
    } else {
      console.log('❌ Warning: is_deleted column not found');
    }

    // Check indexes
    const [indexes] = await connection.query(
      "SHOW INDEXES FROM users WHERE Key_name = 'idx_deletion_scheduled'"
    );
    if ((indexes as any[]).length > 0) {
      console.log('✅ Verified: idx_deletion_scheduled index exists');
    } else {
      console.log('❌ Warning: idx_deletion_scheduled index not found');
    }
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Column already exists, migration may have been run before');
    }
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);
