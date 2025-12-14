import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runAppleMigration() {
  console.log('🍎 Running Apple OAuth Migration...\n');

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
    // Check if already applied
    const [appleIdColumns] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'apple_id'"
    );
    const hasAppleId = (appleIdColumns as any[]).length > 0;

    if (hasAppleId) {
      console.log('⚠️  Migration already applied!');
      console.log('   apple_id column already exists.\n');
      
      // Verify current state
      const [authProviderInfo] = await connection.query(
        "SHOW COLUMNS FROM users WHERE Field = 'auth_provider'"
      );
      const authProviderColumn = (authProviderInfo as any[])[0];
      const hasAppleInEnum = authProviderColumn?.Type?.includes('apple') || false;
      
      if (hasAppleInEnum) {
        console.log('✅ Migration is complete. All columns are in place.');
        await connection.end();
        return;
      } else {
        console.log('⚠️  apple_id exists but auth_provider enum may need update.');
        console.log('   Continuing with migration...\n');
      }
    }

    const migrationFile = join(process.cwd(), 'migrations', '003_add_apple_oauth.sql');
    const sql = readFileSync(migrationFile, 'utf-8');

    console.log('📄 Reading migration file:', migrationFile);
    console.log('📝 Executing SQL...\n');

    await connection.query(sql);
    console.log('✅ Migration completed successfully!\n');

    // Verify migration
    console.log('🔍 Verifying migration...\n');
    
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'apple_id'"
    );
    if ((columns as any[]).length > 0) {
      console.log('✅ Verified: apple_id column exists');
      const appleIdCol = (columns as any[])[0];
      console.log(`   - Type: ${appleIdCol.Type}`);
      console.log(`   - Null: ${appleIdCol.Null}`);
      console.log(`   - Key: ${appleIdCol.Key}`);
    } else {
      console.log('❌ Warning: apple_id column not found');
    }

    const [authProviderColumns] = await connection.query(
      "SHOW COLUMNS FROM users WHERE Field = 'auth_provider'"
    );
    if ((authProviderColumns as any[]).length > 0) {
      const authProviderCol = (authProviderColumns as any[])[0];
      console.log('✅ Verified: auth_provider column exists');
      console.log(`   - Type: ${authProviderCol.Type}`);
      if (authProviderCol.Type.includes('apple')) {
        console.log('   - ✅ Enum includes "apple"');
      } else {
        console.log('   - ⚠️  Enum does not include "apple"');
      }
    } else {
      console.log('❌ Warning: auth_provider column not found');
    }

    // Check index
    const [indexes] = await connection.query(
      "SHOW INDEXES FROM users WHERE Column_name = 'apple_id'"
    );
    if ((indexes as any[]).length > 0) {
      console.log('✅ Verified: Index idx_apple_id exists');
    } else {
      console.log('⚠️  Warning: Index idx_apple_id not found');
    }

    console.log('\n✅ Migration verification complete!');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Column already exists, migration may have been run before');
      console.log('   This is OK if you are re-running the migration.');
    } else if (error.code === 'ER_DUP_KEYNAME') {
      console.log('ℹ️  Index already exists, this is OK.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Database access denied. Check DB_USER and DB_PASS in .env');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('   Database not found. Check DB_NAME in .env');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   Cannot connect to database. Check DB_HOST and ensure MySQL is running');
    }
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runAppleMigration().catch(console.error);
