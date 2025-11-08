import 'dotenv/config';
import pool from './src/config/database.js';
import { hashPassword } from './src/utils/crypto.js';

async function createTestUser() {
  const email = 'test@example.com';
  const password = 'test123456';
  const name = 'Test User';

  try {
    // Check if user exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if ((existingUsers as any[]).length > 0) {
      console.log('✅ User already exists:', email);
      console.log('You can login with:');
      console.log(`  Email: ${email}`);
      console.log(`  Password: ${password}`);
      process.exit(0);
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user with is_verified = 1 (no need to verify email)
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, name, is_verified) VALUES (?, ?, ?, ?)',
      [email, password_hash, name, 1]
    );

    const userId = (result as any).insertId;
    console.log('✅ Test user created successfully!');
    console.log('');
    console.log('User details:');
    console.log(`  ID: ${userId}`);
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Name: ${name}`);
    console.log(`  Verified: true`);
    console.log('');
    console.log('You can now login with:');
    console.log(`  curl -X POST http://localhost:8000/auth/login \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"email":"${email}","password":"${password}"}'`);
    console.log('');
    console.log('Or use the test script:');
    console.log(`  ./get-test-token.sh`);
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createTestUser();

