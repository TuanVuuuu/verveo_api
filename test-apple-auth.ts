import 'dotenv/config';
import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:8000';

async function testAppleAuth() {
  console.log('🍎 Testing Apple Sign-In endpoint...\n');

  // Test 1: Missing idToken
  console.log('Test 1: Missing idToken');
  try {
    await axios.post(`${BASE_URL}/auth/apple`, {
      rawNonce: 'test-nonce-123',
    });
  } catch (error: any) {
    if (error.response) {
      console.log('✅ Expected error:', error.response.status);
      console.log('   Message:', error.response.data?.message || error.response.data);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  console.log('');

  // Test 2: Missing rawNonce
  console.log('Test 2: Missing rawNonce');
  try {
    await axios.post(`${BASE_URL}/auth/apple`, {
      idToken: 'test-token-123',
    });
  } catch (error: any) {
    if (error.response) {
      console.log('✅ Expected error:', error.response.status);
      console.log('   Message:', error.response.data?.message || error.response.data);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  console.log('');

  // Test 3: Empty idToken
  console.log('Test 3: Empty idToken');
  try {
    await axios.post(`${BASE_URL}/auth/apple`, {
      idToken: '',
      rawNonce: 'test-nonce-123',
    });
  } catch (error: any) {
    if (error.response) {
      console.log('✅ Expected error:', error.response.status);
      console.log('   Message:', error.response.data?.message || error.response.data);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  console.log('');

  // Test 4: Empty rawNonce
  console.log('Test 4: Empty rawNonce');
  try {
    await axios.post(`${BASE_URL}/auth/apple`, {
      idToken: 'test-token-123',
      rawNonce: '',
    });
  } catch (error: any) {
    if (error.response) {
      console.log('✅ Expected error:', error.response.status);
      console.log('   Message:', error.response.data?.message || error.response.data);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  console.log('');

  // Test 5: Invalid token format (sẽ fail ở verify token, không phải validation)
  console.log('Test 5: Invalid token format');
  try {
    const response = await axios.post(`${BASE_URL}/auth/apple`, {
      idToken: 'invalid-token-format-123',
      rawNonce: 'test-nonce-123',
    });
    console.log('❌ Unexpected success:', response.status);
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      if (status === 401 || status === 500) {
        console.log('✅ Expected error (token verification failed):', status);
        console.log('   Message:', data?.message || data?.error || data);
      } else if (status === 422) {
        console.log('✅ Expected error (validation):', status);
        console.log('   Message:', data?.message || data);
      } else {
        console.log('⚠️  Unexpected status:', status);
        console.log('   Message:', data?.message || data);
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
  console.log('');

  // Test 6: Valid format but invalid token (test nonce verification)
  console.log('Test 6: Valid format but invalid token (JWT format)');
  try {
    // Tạo một JWT token giả (sẽ fail ở verify với Apple)
    const fakeToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid-signature';
    const response = await axios.post(`${BASE_URL}/auth/apple`, {
      idToken: fakeToken,
      rawNonce: 'test-nonce-123',
    });
    console.log('❌ Unexpected success:', response.status);
  } catch (error: any) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      if (status === 401 || status === 500) {
        console.log('✅ Expected error (token verification failed):', status);
        console.log('   Message:', data?.message || data?.error || data);
      } else {
        console.log('⚠️  Status:', status);
        console.log('   Message:', data?.message || data);
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
  console.log('');

  // Test 7: Check APPLE_CLIENT_ID is configured
  console.log('Test 7: Check APPLE_CLIENT_ID configuration');
  if (process.env.APPLE_CLIENT_ID) {
    console.log('✅ APPLE_CLIENT_ID is set:', process.env.APPLE_CLIENT_ID);
  } else {
    console.log('❌ APPLE_CLIENT_ID is NOT set in .env');
    console.log('   Please add: APPLE_CLIENT_ID=com.vunt.verveo');
  }
  console.log('');

  // Test 8: Valid Apple ID Token (if provided)
  const appleIdToken = process.env.TEST_APPLE_ID_TOKEN;
  const appleRawNonce = process.env.TEST_APPLE_RAW_NONCE;
  if (appleIdToken && appleRawNonce) {
    console.log('Test 8: Valid Apple ID Token');
    try {
      const response = await axios.post(`${BASE_URL}/auth/apple`, {
        idToken: appleIdToken,
        rawNonce: appleRawNonce,
        userInfo: {
          name: 'Test User',
          email: 'test@example.com',
        },
      });
      console.log('✅ Success:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      if (error.response) {
        console.log('❌ Error:', error.response.status);
        console.log('Response:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
  } else {
    console.log('Test 8: Skipped (TEST_APPLE_ID_TOKEN and TEST_APPLE_RAW_NONCE not set)');
    console.log('💡 To test with real token:');
    console.log('   1. Get Apple ID token from iOS app');
    console.log('   2. Set TEST_APPLE_ID_TOKEN and TEST_APPLE_RAW_NONCE in .env');
    console.log('   3. Run test again');
  }
  console.log('');

  console.log('✅ All tests completed!');
  console.log('\n📋 Summary:');
  console.log('  - Validation tests: Should all return 422 (validation error)');
  console.log('  - Invalid token tests: Should return 401 or 500 (verification failed)');
  console.log('  - If APPLE_CLIENT_ID is set: ✅ Configuration OK');
  console.log('  - To test with real token: Set TEST_APPLE_ID_TOKEN and TEST_APPLE_RAW_NONCE in .env');
}

testAppleAuth().catch(console.error);
