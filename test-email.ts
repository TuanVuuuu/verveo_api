import 'dotenv/config';
import { sendVerificationEmail, sendPasswordResetEmail } from './src/services/emailService.js';

async function test() {
  const testEmail = process.env.TEST_EMAIL || 'your-email@example.com';
  
  try {
    console.log('🧪 Testing Brevo Email Service...\n');
    
    // Test verification email
    console.log('📧 Testing verification email...');
    await sendVerificationEmail(testEmail, 'test-verification-token-123');
    console.log('✅ Verification email sent successfully!\n');
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test password reset email
    console.log('📧 Testing password reset email...');
    await sendPasswordResetEmail(testEmail, 'test-reset-token-456');
    console.log('✅ Password reset email sent successfully!\n');
    
    console.log('🎉 All tests passed!');
    console.log(`📬 Check your inbox at: ${testEmail}`);
    console.log('💡 Note: Email might be in spam folder');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.body);
    }
    process.exit(1);
  }
}

test();

