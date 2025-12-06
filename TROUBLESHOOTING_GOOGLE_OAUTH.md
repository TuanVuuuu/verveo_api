# Troubleshooting Google OAuth

## Lỗi: Invalid token khi verify từ mobile app

### Nguyên nhân

Khi mobile app (iOS/Android) tạo Google ID Token, token có `aud` (audience) = iOS/Android Client ID. Nhưng backend đang verify với Web Application Client ID.

**Ví dụ:**
- iOS app tạo token với `aud = 810923455330-18pn3ckc92n85hekhda5jvo395qk5uvb` (iOS Client ID)
- Backend verify với `810923455330-94fheconnompa8f3cn6qdn0atqog1eiv` (Web Client ID)
- Google reject vì `aud` không khớp

### Giải pháp

Google OAuth cho phép verify token từ bất kỳ Client ID nào trong cùng project, nhưng cần cấu hình đúng.

**Option 1: Không specify audience (Recommended)**

Backend có thể verify token từ bất kỳ Client ID nào trong cùng Google project nếu không specify audience cụ thể:

```typescript
// File: src/services/googleAuthService.ts
export const verifyGoogleToken = async (idToken: string): Promise<GoogleTokenPayload> => {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      // Không specify audience - sẽ accept token từ bất kỳ Client ID nào trong project
    });
    // ...
  }
}
```

**Option 2: Accept multiple audiences**

Nếu muốn verify với nhiều Client IDs, có thể check multiple audiences:

```typescript
// File: src/services/googleAuthService.ts
export const verifyGoogleToken = async (idToken: string): Promise<GoogleTokenPayload> => {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      // Không specify audience - accept từ bất kỳ Client ID nào
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken));
    }

    // Verify payload có hợp lệ không
    if (!payload.email || !payload.email_verified) {
      throw new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken));
    }

    return {
      sub: payload.sub,
      email: payload.email || '',
      email_verified: payload.email_verified || false,
      name: payload.name || '',
      picture: payload.picture,
    };
  } catch (error) {
    throw new AppError(ErrorKey.AuthInvalidToken, getErrorMessage(ErrorKey.AuthInvalidToken));
  }
};
```

### Kiểm tra trên VPS

1. **Kiểm tra GOOGLE_CLIENT_ID trong .env:**
```bash
ssh root@45.77.176.83
cd /root/apps/verveo_api
grep GOOGLE_CLIENT_ID .env
```

2. **Kiểm tra logs:**
```bash
sudo journalctl -u api_verveo -f
```

3. **Test endpoint:**
```bash
curl -X POST https://api.verveo.click/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"test-invalid-token"}'
```

## Lỗi khác

### "OAuth access is restricted to test users"

**Nguyên nhân:** App đang ở testing mode

**Giải pháp:**
1. Vào Google Cloud Console → Google Auth Platform → Audience
2. Thêm email vào "Test users"

### "Network error" hoặc timeout

**Nguyên nhân:** Backend không chạy hoặc network issue

**Giải pháp:**
1. Kiểm tra backend: `curl https://api.verveo.click/health`
2. Kiểm tra service: `sudo systemctl status api_verveo`
3. Kiểm tra logs: `sudo journalctl -u api_verveo -n 50`

