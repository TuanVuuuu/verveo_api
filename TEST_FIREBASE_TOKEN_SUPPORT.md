# Test Firebase ID Token Support

## Tổng quan

Endpoint `/auth/google` đã được cập nhật để hỗ trợ cả **Google ID Token** và **Firebase ID Token**.

## Thay đổi

### 1. Thêm function `verifyFirebaseToken`
- Verify Firebase ID Token bằng Firebase Admin SDK
- Trả về cùng format `GoogleTokenPayload` để tương thích

### 2. Thêm function `verifyToken` (wrapper)
- Tự động detect và verify token:
  - Thử verify Google ID Token trước
  - Nếu fail, thử verify Firebase ID Token
  - Nếu cả hai đều fail, throw error

### 3. Cập nhật `loginOrRegisterWithGoogle`
- Sử dụng `verifyToken` thay vì `verifyGoogleToken`
- Hỗ trợ cả hai loại token mà không cần thay đổi logic xử lý user

## Kết quả Test

### Test Verification Functions
```bash
npm run test-token-verification
```

**Kết quả:**
- ✅ Firebase Admin SDK initialized successfully
- ✅ Invalid Google ID Token → Expected error
- ✅ Invalid Firebase ID Token → Expected error
- ✅ verifyToken với invalid token → Expected error (tried both)

### Test API Endpoint
```bash
npm run test-google-auth
```

**Kết quả:**
- ✅ Missing idToken → 422 (validation error)
- ✅ Empty idToken → 422 (validation error)
- ✅ Invalid idToken → 401 (invalid token)
- ⚠️ Valid tokens test skipped (cần token thật)

## Cách sử dụng

### Với Google ID Token
```bash
curl -X POST http://localhost:8000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "YOUR_GOOGLE_ID_TOKEN"}'
```

### Với Firebase ID Token
```bash
curl -X POST http://localhost:8000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "YOUR_FIREBASE_ID_TOKEN"}'
```

Endpoint sẽ tự động detect và verify đúng loại token.

## Lưu ý

1. **Firebase Admin SDK**: Cần được khởi tạo (đã có trong `index.ts` qua `fcmService.initializeFirebase()`)
2. **Fallback logic**: Nếu Firebase chưa được cấu hình, chỉ Google ID Token hoạt động
3. **Logic xử lý user**: Không thay đổi, vẫn giữ nguyên logic login/register

## Test với token thật

Để test với token thật, set trong `.env`:
```env
TEST_GOOGLE_ID_TOKEN=your-google-id-token-here
TEST_FIREBASE_ID_TOKEN=your-firebase-id-token-here
```

Sau đó chạy:
```bash
npm run test-google-auth
npm run test-token-verification
```

## Files đã thay đổi

1. `src/services/googleAuthService.ts` - Thêm hỗ trợ Firebase ID Token
2. `test-google-auth.ts` - Cập nhật test để test cả Firebase token
3. `test-token-verification.ts` - Test mới để test verification functions
4. `package.json` - Thêm script `test-token-verification`

## Status

✅ **Hoàn thành và đã test**
- Code đã được cập nhật
- Test functions đã pass
- Test endpoint đã pass
- Sẵn sàng để deploy lên VPS

