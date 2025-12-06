# Quick Test Guide - Google OAuth

## 1. Setup

```bash
# 1. Thêm GOOGLE_CLIENT_ID vào .env
echo "GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com" >> .env

# 2. Chạy database migration
npm run run-migration

# 3. Start server
npm run dev
```

## 2. Test

```bash
# Test với script (không cần token thật)
npm run test-google-auth

# Test với cURL (cần Google ID Token)
curl -X POST http://localhost:8000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"your-google-id-token"}'
```

## 3. Verify

```sql
-- Kiểm tra users table
SELECT id, email, name, google_id, auth_provider, is_verified 
FROM users 
WHERE auth_provider = 'google';
```

Xem chi tiết tại: [TEST_GOOGLE_OAUTH.md](./TEST_GOOGLE_OAUTH.md)

