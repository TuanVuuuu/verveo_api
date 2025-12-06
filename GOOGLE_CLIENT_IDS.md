# Google OAuth Client IDs

Danh sách các OAuth Client IDs đã tạo cho Verveo app.

## Client IDs

### 1. Web Application (Backend)
- **Name**: Verveo Backend
- **Client ID**: `YOUR_WEB_CLIENT_ID.apps.googleusercontent.com` (⚠️ Lưu trong `.env`, không commit)
- **Client Secret**: `YOUR_CLIENT_SECRET` (⚠️ Lưu an toàn, không commit)
- **Purpose**: Backend API verification
- **Authorized JavaScript origins**:
  - `http://localhost:8000` (local)
  - `https://api.verveo.click` (production)
- **Environment Variable**: `GOOGLE_CLIENT_ID` (trong `.env` trên VPS)
- **⚠️ Lưu ý**: 
  - Client ID và Client Secret được lưu trong `.env` (không commit vào git)
  - Xem Google Cloud Console để lấy Client ID thật

### 2. iOS Application
- **Name**: Verveo iOS
- **Client ID**: `YOUR_IOS_CLIENT_ID.apps.googleusercontent.com` (⚠️ Lưu trong iOS app config, không commit)
- **Bundle ID**: `com.verveo.app`
- **Team ID**: `YOUR_TEAM_ID` (⚠️ Không commit)
- **Purpose**: iOS app Google Sign-In
- **Usage**: Cấu hình trong iOS app (Xcode)

## Lưu ý quan trọng

### Backend
- Backend chỉ cần **Web Application Client ID** để verify Google ID Token
- Backend có thể verify ID Token từ bất kỳ platform nào (iOS, Android, Web) miễn là cùng Google project
- **Không cần** iOS Client ID trong backend

### iOS App
- iOS app cần **iOS Client ID** để tạo Google ID Token
- iOS app gửi ID Token lên backend
- Backend verify token với **Web Application Client ID**

### Cách hoạt động
1. iOS app dùng **iOS Client ID** để tạo Google ID Token
2. iOS app gửi ID Token lên backend: `POST /auth/google`
3. Backend verify token với **Web Application Client ID**
4. Nếu token hợp lệ, backend trả về JWT token

## Cấu hình trong iOS App

### AppDelegate.swift hoặc SceneDelegate.swift

```swift
import GoogleSignIn

// ⚠️ Lấy Client ID từ Google Cloud Console, không hardcode
let iosClientID = "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com"
GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: iosClientID)
```

### Info.plist

Thêm URL scheme để Google Sign-In redirect về app:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.googleusercontent.apps.810923455330-18pn3ckc92n85hekhda5jvo395qk5uvb</string>
        </array>
    </dict>
</array>
```

**Lưu ý**: URL scheme format: `com.googleusercontent.apps.<CLIENT_ID_WITHOUT_SUFFIX>`
- Client ID: `YOUR_IOS_CLIENT_ID.apps.googleusercontent.com`
- URL scheme: `com.googleusercontent.apps.YOUR_IOS_CLIENT_ID` (bỏ phần `.apps.googleusercontent.com`)

## Security

- ⚠️ **KHÔNG commit** Client IDs vào public repository
- ⚠️ **KHÔNG share** Client Secret
- ✅ Lưu Client IDs trong environment variables hoặc config files (không commit)
- ✅ Sử dụng `.gitignore` để exclude files chứa sensitive data

## Related Documentation

- [MOBILE_TEST_GOOGLE_OAUTH.md](./MOBILE_TEST_GOOGLE_OAUTH.md) - Hướng dẫn test trên mobile
- [TEST_GOOGLE_OAUTH.md](./TEST_GOOGLE_OAUTH.md) - Hướng dẫn test local
- [GOOGLE_OAUTH_SETUP_PROGRESS.md](./GOOGLE_OAUTH_SETUP_PROGRESS.md) - Tiến trình setup

