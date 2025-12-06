# Google OAuth Setup Progress

## Tiến trình Setup Google OAuth

### ✅ Đã hoàn thành

- [x] **Tạo Google Cloud Project**
  - Project name: `vunt` (hoặc project khác)
  - Đã tạo project thành công

- [x] **Hoàn thành Project Configuration**
  - App Information:
    - App name: `Verveo` ✅
    - User support email: `tuanvuanbai@gmail.com` ✅
  - Audience: Chọn **External** ✅
  - Contact Information: Đã điền ✅
  - OAuth configuration đã được tạo ✅

- [x] **Tạo OAuth 2.0 Client ID**
  - Application type: **Web application** ✅
  - Name: **Verveo Backend** ✅
  - Authorized JavaScript origins:
    - `http://localhost:8000` ✅
    - `https://api.verveo.click` ✅
  - Client ID: `63466806735-hb98hqu58pe6ddlgpvsci1p4d2tit5du.apps.googleusercontent.com` ✅
  - Client secret: `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` ✅ (đã lưu)
  - Status: Enabled ✅
  - Creation date: December 6, 2025 ✅

- [x] **Thêm Client ID vào .env**
  ```env
  GOOGLE_CLIENT_ID=63466806735-hb98hqu58pe6ddlgpvsci1p4d2tit5du.apps.googleusercontent.com
  ```
  ✅ Đã thêm vào file `.env`

- [x] **Chạy database migration** ✅
  - ✅ Đã thêm `google_id` column (VARCHAR(255), nullable, unique)
  - ✅ Đã thêm `auth_provider` column (ENUM: 'email' | 'google', default 'email')
  - ✅ Đã làm `password_hash` nullable
  - ✅ Đã update existing users với `auth_provider = 'email'`

- [x] **Start server và test** ✅
  - ✅ Server đã start thành công tại `http://localhost:8000`
  - ✅ Test script đã chạy thành công
  - ✅ Tất cả test cases đều pass:
    - Missing idToken → 422 error ✅
    - Empty idToken → 422 error ✅
    - Invalid token format → 401 error ✅

### ✅ Hoàn thành Setup

Tất cả các bước setup đã hoàn thành! 🎉

### 📋 Test với Google ID Token thật

Để test với Google ID Token thật, bạn cần:
1. Lấy Google ID Token từ mobile app hoặc web browser
2. Thêm vào `.env`:
   ```env
   TEST_GOOGLE_ID_TOKEN=your-google-id-token-here
   ```
3. Chạy lại test: `npm run test-google-auth`

## Hướng dẫn điền form OAuth Client

### Authorized redirect URIs

**Lưu ý**: Đối với backend API, bạn có thể:
- **Option 1**: Để trống (không cần redirect URIs cho backend API)
- **Option 2**: Thêm callback URL nếu cần:
  - `http://localhost:8000/auth/google/callback` (local)
  - `https://api.verveo.click/auth/google/callback` (production)

**Khuyến nghị**: Để trống vì backend API chỉ nhận ID Token từ mobile app, không cần redirect.

### Sau khi nhấn "Create"

1. Màn hình sẽ hiển thị **Client ID** và **Client secret**
2. **Chỉ cần copy Client ID** (Client secret không cần cho backend)
3. Client ID có dạng: `123456789-abc123def456.apps.googleusercontent.com`

## Next Steps

### ✅ Đã hoàn thành:
1. ✅ Tạo OAuth Client ID
2. ✅ Thêm vào `.env` file

### ⏳ Cần làm tiếp:
1. Chạy database migration: `npm run run-migration`
2. Start server: `npm run dev`
3. Test endpoint: `npm run test-google-auth`

## Lưu ý quan trọng

### Client Secret
- **Client secret**: `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`
- ⚠️ **Lưu ý**: Client secret không cần cho backend API (chỉ cần Client ID)
- 💾 **Nên lưu lại** Client secret ở nơi an toàn (phòng khi cần dùng sau)
- ⚠️ **Cảnh báo từ Google**: Từ tháng 6/2025, bạn sẽ không thể xem lại Client secret sau khi đóng dialog này

### Test Users
- App đang ở **testing mode**
- Chỉ **test users** mới có thể đăng nhập
- Để thêm test users:
  1. Vào Google Cloud Console → Google Auth Platform → Audience
  2. Scroll xuống phần "Test users"
  3. Thêm email của bạn vào danh sách

Xem chi tiết: [TEST_GOOGLE_OAUTH.md](./TEST_GOOGLE_OAUTH.md)

