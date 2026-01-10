import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  // Get migration file from command line argument
  const migrationFileName = process.argv[2] || '001_add_google_oauth.sql';
  
  if (!migrationFileName.endsWith('.sql')) {
    console.error('❌ Invalid migration file. Must be a .sql file');
    console.error('💡 Usage: npm run run-migration <migration-file.sql>');
    console.error('   Example: npm run run-migration 006_add_manual_plan.sql');
    process.exit(1);
  }

  console.log(`🔄 Running database migration: ${migrationFileName}\n`);

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
    const migrationFile = join(process.cwd(), 'migrations', migrationFileName);
    const sql = readFileSync(migrationFile, 'utf-8');

    console.log('📄 Reading migration file:', migrationFile);
    console.log('📝 SQL to execute:\n', sql, '\n');

    await connection.query(sql);
    console.log('✅ Migration completed successfully!\n');

    // Verify migration based on file name
    if (migrationFileName.includes('006_add_manual_plan')) {
      console.log('🔍 Verifying manual plan columns...');
      const columnsToCheck = [
        'manual_plan_is_active',
        'manual_plan_product_id',
        'manual_plan_entitlement_id',
        'manual_plan_status',
        'manual_plan_expires_at',
      ];

      for (const column of columnsToCheck) {
        const [columns] = await connection.query(
          `SHOW COLUMNS FROM users LIKE '${column}'`
        );
        if ((columns as any[]).length > 0) {
          console.log(`✅ Verified: ${column} column exists`);
        } else {
          console.log(`❌ Warning: ${column} column not found`);
        }
      }
    } else if (migrationFileName.includes('001_add_google_oauth')) {
      console.log('🔍 Verifying Google OAuth columns...');
      const [columns] = await connection.query(
        "SHOW COLUMNS FROM users LIKE 'google_id'"
      );
      if ((columns as any[]).length > 0) {
        console.log('✅ Verified: google_id column exists');
      } else {
        console.log('❌ Warning: google_id column not found');
      }

      const [authProviderColumns] = await connection.query(
        "SHOW COLUMNS FROM users LIKE 'auth_provider'"
      );
      if ((authProviderColumns as any[]).length > 0) {
        console.log('✅ Verified: auth_provider column exists');
      } else {
        console.log('❌ Warning: auth_provider column not found');
      }
    }
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Column already exists, migration may have been run before');
      console.log('💡 You can safely ignore this if columns already exist');
    }
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);

