import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join } from 'path';

async function testAppleMigration() {
  console.log('🍎 Testing Apple OAuth Migration...\n');

  // Check environment variables
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
    console.log('📊 Step 1: Checking current database schema...\n');

    // Check if apple_id column exists
    const [appleIdColumns] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'apple_id'"
    );
    const hasAppleId = (appleIdColumns as any[]).length > 0;

    // Check auth_provider enum values
    const [authProviderInfo] = await connection.query(
      "SHOW COLUMNS FROM users WHERE Field = 'auth_provider'"
    );
    const authProviderColumn = (authProviderInfo as any[])[0];
    const hasAppleInEnum = authProviderColumn?.Type?.includes('apple') || false;

    console.log('Current state:');
    console.log(`  - apple_id column: ${hasAppleId ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    console.log(`  - auth_provider enum: ${hasAppleInEnum ? '✅ HAS apple' : '❌ NO apple'}`);
    console.log('');

    if (hasAppleId && hasAppleInEnum) {
      console.log('✅ Migration already applied!');
      console.log('   Apple OAuth columns are already in the database.\n');
      
      // Show detailed info
      console.log('📋 Detailed column information:');
      const [columns] = await connection.query('DESCRIBE users');
      const usersColumns = columns as any[];
      
      const appleIdCol = usersColumns.find((col: any) => col.Field === 'apple_id');
      const authProviderCol = usersColumns.find((col: any) => col.Field === 'auth_provider');
      
      if (appleIdCol) {
        console.log('\napple_id column:');
        console.log(`  - Type: ${appleIdCol.Type}`);
        console.log(`  - Null: ${appleIdCol.Null}`);
        console.log(`  - Key: ${appleIdCol.Key}`);
        console.log(`  - Default: ${appleIdCol.Default || 'NULL'}`);
      }
      
      if (authProviderCol) {
        console.log('\nauth_provider column:');
        console.log(`  - Type: ${authProviderCol.Type}`);
        console.log(`  - Null: ${authProviderCol.Null}`);
        console.log(`  - Default: ${authProviderCol.Default || 'NULL'}`);
      }
      
      // Check index
      console.log('\n📇 Checking indexes...');
      const [indexes] = await connection.query(
        "SHOW INDEXES FROM users WHERE Column_name = 'apple_id'"
      );
      if ((indexes as any[]).length > 0) {
        console.log('✅ Index idx_apple_id exists');
      } else {
        console.log('⚠️  Index idx_apple_id not found (may need to add)');
      }
      
      await connection.end();
      return;
    }

    console.log('📄 Step 2: Reading migration file...\n');
    const migrationFile = join(process.cwd(), 'migrations', '003_add_apple_oauth.sql');
    
    try {
      const sql = readFileSync(migrationFile, 'utf-8');
      console.log('✅ Migration file found:', migrationFile);
      console.log('📝 SQL to execute:\n', sql, '\n');
    } catch (error: any) {
      console.error('❌ Cannot read migration file:', error.message);
      await connection.end();
      process.exit(1);
    }

    console.log('⚠️  Migration not yet applied.');
    console.log('💡 To apply migration, run: npm run run-apple-migration\n');
    
    // Show what will be added
    console.log('📋 What will be added:');
    console.log('  1. apple_id column (VARCHAR(255), nullable, unique)');
    console.log('  2. Index idx_apple_id on apple_id');
    console.log('  3. Update auth_provider enum to include "apple"');

  } catch (error: any) {
    console.error('❌ Error checking migration:', error.message);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
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

testAppleMigration().catch(console.error);
