# Hướng dẫn Test Google OAuth trên Mobile App

## ✅ Checklist Trước Khi Test

### Backend (VPS)
- [x] Code đã được deploy lên VPS
- [x] Database migration đã chạy thành công
- [x] `GOOGLE_CLIENT_ID` đã được thêm vào `.env`
- [x] Service đã được restart
- [x] Endpoint `/auth/google` trả về 401 cho invalid token

### Google Cloud Console
- [x] OAuth Client ID đã được tạo
- [x] Client ID: Đã tạo trong Google Cloud Console (lưu trong app config, không commit)
- [ ] **Test users** đã được thêm (nếu app ở testing mode)
- [ ] **Authorized JavaScript origins** đã có:
  - `https://api.verveo.click` (production)

### Mobile App
- [ ] Google Sign-In SDK đã được cài đặt
- [ ] Client ID đã được cấu hình trong app
- [ ] App đã được build và cài đặt trên device

## 📱 Test trên Mobile App

### 1. Flutter App

#### Setup Google Sign-In

**pubspec.yaml:**
```yaml
dependencies:
  google_sign_in: ^6.1.5
  http: ^1.1.0
```

**Cấu hình Google Sign-In:**
```dart
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

final GoogleSignIn _googleSignIn = GoogleSignIn(
  scopes: ['email'],
);

// Client ID từ Google Cloud Console (iOS Client ID)
// ⚠️ Lấy từ Google Cloud Console, không hardcode
final String googleClientId = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
```

#### Test Flow

```dart
Future<void> signInWithGoogle() async {
  try {
    // 1. Sign in với Google
    final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
    
    if (googleUser == null) {
      // User cancelled
      return;
    }

    // 2. Lấy authentication
    final GoogleSignInAuthentication googleAuth = 
        await googleUser.authentication;

    // 3. Lấy ID Token
    final String? idToken = googleAuth.idToken;
    
    if (idToken == null) {
      print('Error: ID Token is null');
      return;
    }

    print('ID Token: ${idToken.substring(0, 50)}...');

    // 4. Gửi ID Token lên backend
    final response = await http.post(
      Uri.parse('https://api.verveo.click/auth/google'),
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'idToken': idToken,
      }),
    );

    print('Status Code: ${response.statusCode}');
    print('Response: ${response.body}');

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data['status'] == 0) {
        final token = data['data']['token'];
        final user = data['data']['user'];
        final isNewUser = data['data']['isNewUser'];
        
        print('✅ Login thành công!');
        print('User: ${user['name']} (${user['email']})');
        print('Is New User: $isNewUser');
        print('JWT Token: ${token.substring(0, 50)}...');
        
        // Lưu token để dùng cho các API calls sau
        // await saveToken(token);
      } else {
        print('❌ Error: ${data['message']}');
      }
    } else {
      print('❌ HTTP Error: ${response.statusCode}');
      print('Response: ${response.body}');
    }
  } catch (e) {
    print('❌ Exception: $e');
  }
}
```

### 2. Android App (Kotlin)

#### Setup Google Sign-In

**build.gradle (app):**
```gradle
dependencies {
    implementation 'com.google.android.gms:play-services-auth:20.7.0'
}
```

**AndroidManifest.xml:**
```xml
<activity
    android:name="com.google.android.gms.auth.api.signin.RevocationBoundService"
    android:exported="true"
    android:permission="com.google.android.gms.auth.api.signin.permission.REVOCATION_NOTIFICATION" />
```

**MainActivity.kt:**
```kotlin
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.auth.api.signin.GoogleSignInAccount

class MainActivity : AppCompatActivity() {
    // Sử dụng Android Client ID (cần tạo riêng cho Android)
    private val googleClientId = "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com"
    
    private fun signInWithGoogle() {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(googleClientId)
            .requestEmail()
            .build()
        
        val googleSignInClient = GoogleSignIn.getClient(this, gso)
        val signInIntent = googleSignInClient.signInIntent
        startActivityForResult(signInIntent, RC_SIGN_IN)
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        if (requestCode == RC_SIGN_IN) {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            task.addOnSuccessListener { account ->
                val idToken = account.idToken
                sendTokenToBackend(idToken)
            }.addOnFailureListener { e ->
                Log.e("GoogleSignIn", "Error: ${e.message}")
            }
        }
    }
    
    private fun sendTokenToBackend(idToken: String?) {
        // Gửi token lên backend
        // Sử dụng Retrofit, OkHttp, hoặc Volley
    }
}
```

### 3. iOS App (Swift)

#### Setup Google Sign-In

**Podfile:**
```ruby
pod 'GoogleSignIn'
```

**AppDelegate.swift:**
```swift
import GoogleSignIn

func application(_ application: UIApplication, 
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    // ⚠️ Lấy từ Google Cloud Console, không hardcode
    let clientID = "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com"
    GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
    return true
}
```

**Sign In:**
```swift
@IBAction func signInWithGoogle(_ sender: Any) {
    guard let presentingViewController = self else { return }
    
    GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController) { result, error in
        guard let result = result, error == nil else {
            print("Error: \(error?.localizedDescription ?? "Unknown error")")
            return
        }
        
        let user = result.user
        let idToken = user.idToken?.tokenString
        
        if let idToken = idToken {
            sendTokenToBackend(idToken: idToken)
        }
    }
}

func sendTokenToBackend(idToken: String) {
    // Gửi token lên backend
    // Sử dụng URLSession hoặc Alamofire
}
```

## 🧪 Test Cases

### Test Case 1: User mới (chưa có trong DB)

**Expected:**
- User chọn "Sign in with Google"
- Google Sign-In dialog hiển thị
- User chọn account và authorize
- Backend tạo user mới
- Response: `isNewUser: true`
- App nhận JWT token và lưu lại

### Test Case 2: User đã tồn tại (đăng nhập lại)

**Expected:**
- User chọn "Sign in with Google"
- Chọn cùng Google account
- Backend tìm thấy user theo `google_id`
- Response: `isNewUser: false`
- App nhận JWT token

### Test Case 3: Link Google account với email/password account

**Steps:**
1. Tạo user bằng email/password trước
2. Login bằng Google với cùng email
3. Backend tự động link Google account
4. Response: `isNewUser: false`
5. User có thể login bằng cả email/password hoặc Google

### Test Case 4: Invalid token

**Expected:**
- App gửi invalid token
- Backend trả về 401 error
- App hiển thị error message

## 🔍 Debugging

### Kiểm tra ID Token

**Flutter:**
```dart
print('ID Token length: ${idToken?.length}');
print('ID Token preview: ${idToken?.substring(0, 50)}...');
```

**Android:**
```kotlin
Log.d("GoogleSignIn", "ID Token: ${idToken?.take(50)}...")
```

**iOS:**
```swift
print("ID Token: \(idToken.prefix(50))...")
```

### Kiểm tra Backend Response

**Success Response:**
```json
{
  "status": 0,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "email": "user@gmail.com",
      "name": "John Doe"
    },
    "isNewUser": true
  }
}
```

**Error Response:**
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

### Kiểm tra Backend Logs

```bash
# SSH vào VPS
ssh root@45.77.176.83

# Xem logs
sudo journalctl -u api_verveo -f
```

## 🐛 Troubleshooting

### Lỗi: "Invalid token"

**Nguyên nhân:**
- Client ID không khớp
- Token đã hết hạn
- Token không hợp lệ

**Giải pháp:**
1. Kiểm tra Client ID trong app có đúng không
2. Kiểm tra `GOOGLE_CLIENT_ID` trong `.env` trên VPS
3. Đảm bảo token được lấy ngay sau khi sign in

### Lỗi: "OAuth access is restricted to test users"

**Nguyên nhân:**
- App đang ở testing mode
- Email chưa được thêm vào test users

**Giải pháp:**
1. Vào Google Cloud Console
2. Google Auth Platform → Audience
3. Thêm email vào "Test users"

### Lỗi: "Network error" hoặc "Connection refused"

**Nguyên nhân:**
- Backend không chạy
- URL không đúng
- Network issue

**Giải pháp:**
1. Kiểm tra backend đang chạy: `curl https://api.verveo.click/health`
2. Kiểm tra URL trong app: `https://api.verveo.click/auth/google`
3. Kiểm tra network connection

### Lỗi: "ID Token is null"

**Nguyên nhân:**
- Google Sign-In chưa request ID Token
- User cancelled sign in

**Giải pháp:**
1. Đảm bảo request ID Token trong Google Sign-In config
2. Kiểm tra user đã authorize chưa

## ✅ Success Criteria

- [ ] User có thể sign in với Google
- [ ] ID Token được gửi lên backend thành công
- [ ] Backend trả về JWT token
- [ ] User mới được tạo trong database
- [ ] User đã tồn tại có thể login lại
- [ ] Google account được link với email/password account
- [ ] JWT token có thể dùng cho các API calls sau

## 📝 Notes

- **Client ID**: Phải dùng cùng Client ID cho cả mobile app và backend
- **Test Users**: Nếu app ở testing mode, chỉ test users mới có thể login
- **Production**: Khi app ready, submit để verify trong Google Cloud Console
- **Security**: Không commit Client ID vào public repository

## 🔗 Related Documentation

- [TEST_GOOGLE_OAUTH.md](./TEST_GOOGLE_OAUTH.md) - Test local
- [API_SPEC.md](../../idea_2.0/API_SPEC.md) - API documentation
- [08-update-v2.0.7-google-oauth.md](../../vps_nodejs/08-update-v2.0.7-google-oauth.md) - VPS deployment

