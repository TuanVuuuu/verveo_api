# Hướng dẫn Test Google OAuth ở Local

## Tiến trình Setup

- [x] **Bước 1**: Tạo Google Cloud Project và OAuth Configuration
- [x] **Bước 2**: Hoàn thành Project Configuration (App Information, Audience, Contact Information)
- [x] **Bước 3**: Tạo OAuth 2.0 Client ID cho Web application
  - Client ID: `63466806735-hb98hqu58pe6ddlgpvsci1p4d2tit5du.apps.googleusercontent.com` ✅
- [x] **Bước 4**: Thêm Client ID vào `.env` ✅
- [x] **Bước 5**: Chạy database migration ✅
  - ✅ Đã thêm `google_id` column
  - ✅ Đã thêm `auth_provider` column
  - ✅ Đã làm `password_hash` nullable
- [x] **Bước 6**: Start server và test ✅
  - ✅ Server đã start tại `http://localhost:8000`
  - ✅ Test script đã chạy thành công
  - ✅ Tất cả test cases đều pass

---

## Bước 1: Setup Environment Variables

Thêm vào file `.env`:

```env
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

**Lưu ý**: Bạn cần tạo OAuth 2.0 Client ID trong Google Cloud Console:
1. ✅ Vào [Google Cloud Console](https://console.cloud.google.com/)
2. ✅ Tạo project mới hoặc chọn project hiện có
3. ✅ Hoàn thành Project Configuration (App Information, Audience, Contact Information)
4. ✅ Tạo OAuth 2.0 Client ID:
   - Application type: **Web application** ✅
   - Name: **Verveo Backend** ✅
   - Authorized JavaScript origins: 
     - `http://localhost:8000` ✅
     - `https://api.verveo.click` ✅
   - **Client ID**: `63466806735-hb98hqu58pe6ddlgpvsci1p4d2tit5du.apps.googleusercontent.com` ✅
   - **Client secret**: `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` ✅ (đã lưu, không cần cho backend)
   - ⏳ Copy Client ID vào `.env` (bước tiếp theo)

## Bước 2: Hoàn thành tạo OAuth Client ID

Sau khi nhấn "Create" trong Google Cloud Console:

1. **Copy Client ID**: Bạn sẽ thấy màn hình hiển thị Client ID (dạng `123456789-abc.apps.googleusercontent.com`)
2. **Thêm vào .env**: Mở file `.env` và thêm:
   ```env
   GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
   ```
   (Thay bằng Client ID thật của bạn)

## Bước 3: Chạy Database Migration

```bash
npm run run-migration
```

Script này sẽ:
- Thêm `google_id` column vào bảng `users`
- Thêm `auth_provider` column
- Làm `password_hash` nullable

## Bước 4: Start Server

```bash
npm run dev
```

Server sẽ chạy ở `http://localhost:8000`

## Bước 5: Test Endpoint

### 4.1. Test với Script (Không cần token thật)

```bash
npm run test-google-auth
```

Script này sẽ test:
- Missing idToken → 422 error
- Empty idToken → 422 error  
- Invalid token format → 401 error
- Valid token (nếu có TEST_GOOGLE_ID_TOKEN trong .env)

### 4.2. Test với cURL (Cần Google ID Token)

#### Test với invalid token:
```bash
curl -X POST http://localhost:8000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"invalid-token-123"}'
```

Expected response:
```json
{
  "status": 1,
  "message": "error.auth.invalid_token",
  "data": {
    "errorCode": 401,
    "errorKey": "error.auth.invalid_token",
    "description": "Invalid token"
  },
  "description": "Invalid token"
}
```

#### Test với valid Google ID Token:

Để lấy Google ID Token thật, bạn có thể:

**Option 1: Từ Mobile App (Android/iOS)**
- Sử dụng Google Sign-In SDK
- Lấy ID Token sau khi user đăng nhập
- Gửi token lên backend

**Option 2: Từ Web Browser (cho testing)**
- Sử dụng Google Identity Services
- Lấy ID Token từ response
- Gửi token lên backend

**Option 3: Test với Postman/Insomnia**
1. Tạo request POST đến `http://localhost:8000/auth/google`
2. Body: `{"idToken": "<your-google-id-token>"}`
3. Headers: `Content-Type: application/json`

### 4.3. Test Flow Hoàn Chỉnh

1. **User mới (chưa có trong DB)**:
   ```bash
   curl -X POST http://localhost:8000/auth/google \
     -H "Content-Type: application/json" \
     -d '{"idToken":"<valid-google-id-token>"}'
   ```
   
   Expected: Tạo user mới, trả về `isNewUser: true`

2. **User đã tồn tại (đăng nhập lại)**:
   ```bash
   curl -X POST http://localhost:8000/auth/google \
     -H "Content-Type: application/json" \
     -d '{"idToken":"<same-google-id-token>"}'
   ```
   
   Expected: Login thành công, trả về `isNewUser: false`

3. **Link Google account với email/password account**:
   - Tạo user bằng email/password trước
   - Sau đó login bằng Google với cùng email
   - Expected: Link Google account, không tạo user mới

## Bước 6: Verify Database

Kiểm tra database để đảm bảo data đúng:

```sql
-- Xem users với Google OAuth
SELECT id, email, name, google_id, auth_provider, is_verified, password_hash 
FROM users 
WHERE auth_provider = 'google';

-- Xem tất cả users
SELECT id, email, name, google_id, auth_provider, is_verified 
FROM users;
```

## Troubleshooting

### Lỗi: "Invalid token"
- Kiểm tra `GOOGLE_CLIENT_ID` trong `.env` có đúng không
- Kiểm tra Google ID Token có hợp lệ không (có thể đã expire)
- Kiểm tra Client ID trong token có match với `GOOGLE_CLIENT_ID` không

### Lỗi: "Column 'google_id' doesn't exist"
- Chạy migration: `npm run run-migration`

### Lỗi: "Cannot read property 'sub' of undefined"
- Google ID Token không hợp lệ hoặc không có payload
- Kiểm tra token format

### Lỗi: Connection refused
- Đảm bảo server đang chạy: `npm run dev`
- Kiểm tra PORT trong `.env` (default: 8000)

## Test với Mobile App

Khi test từ mobile app (Android/iOS):

1. **Android**: Sử dụng `GoogleSignIn` SDK
   ```kotlin
   val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
       .requestIdToken("YOUR_CLIENT_ID")
       .requestEmail()
       .build()
   ```

2. **iOS**: Sử dụng `GoogleSignIn` SDK
   ```swift
   GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: "YOUR_CLIENT_ID")
   ```

3. Lấy ID Token từ response và gửi lên backend:
   ```dart
   // Flutter example
   final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
   final GoogleSignInAuthentication googleAuth = await googleUser!.authentication;
   final String idToken = googleAuth.idToken!;
   
   // Send to backend
   final response = await http.post(
     Uri.parse('http://localhost:8000/auth/google'),
     headers: {'Content-Type': 'application/json'},
     body: jsonEncode({'idToken': idToken}),
   );
   ```

## Checklist Trước Khi Deploy

- [ ] Database migration đã chạy thành công
- [ ] `GOOGLE_CLIENT_ID` đã được set trong `.env`
- [ ] Test với invalid token → trả về 401
- [ ] Test với valid token → tạo/login user thành công
- [ ] Test link account (email/password + Google) → hoạt động đúng
- [ ] Verify database có đúng data
- [ ] Server không có lỗi khi start

