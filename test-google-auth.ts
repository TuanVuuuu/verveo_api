import 'dotenv/config';
import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:8000';

async function testGoogleAuth() {
  console.log('🧪 Testing Google OAuth endpoint...\n');

  // Test 1: Missing idToken
  console.log('Test 1: Missing idToken');
  try {
    await axios.post(`${BASE_URL}/auth/google`, {});
  } catch (error: any) {
    if (error.response) {
      console.log('✅ Expected error:', error.response.status, error.response.data);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  console.log('');

  // Test 2: Empty idToken
  console.log('Test 2: Empty idToken');
  try {
    await axios.post(`${BASE_URL}/auth/google`, { idToken: '' });
  } catch (error: any) {
    if (error.response) {
      console.log('✅ Expected error:', error.response.status, error.response.data);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  console.log('');

  // Test 3: Invalid idToken format
  console.log('Test 3: Invalid idToken format');
  try {
    await axios.post(`${BASE_URL}/auth/google`, { idToken: 'invalid-token-123' });
  } catch (error: any) {
    if (error.response) {
      console.log('✅ Expected error:', error.response.status, error.response.data);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  console.log('');

  // Test 4: Valid Google ID Token (if provided)
  const googleIdToken = process.env.TEST_GOOGLE_ID_TOKEN;
  if (googleIdToken) {
    console.log('Test 4: Valid Google ID Token');
    try {
      const response = await axios.post(`${BASE_URL}/auth/google`, {
        idToken: googleIdToken,
      });
      console.log('✅ Success:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      if (error.response) {
        console.log('❌ Error:', error.response.status, error.response.data);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
  } else {
    console.log('Test 4: Skipped (TEST_GOOGLE_ID_TOKEN not set)');
    console.log('💡 To test with real token, set TEST_GOOGLE_ID_TOKEN in .env');
  }
  console.log('');

  console.log('✅ All tests completed!');
}

testGoogleAuth().catch(console.error);

