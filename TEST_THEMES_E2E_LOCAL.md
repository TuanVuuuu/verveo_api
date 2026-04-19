# Themes API E2E Test (Local)

File này giúp test end-to-end theo thứ tự:

1. Lấy themes
2. Post theme (bắt buộc `imgUrl`, tự generate `blurHash` nếu thiếu)
3. Xoá theme

> Gợi ý: chạy trên local trước khi deploy VPS.

---

## 0) Preconditions

- Server chạy local (khuyến nghị tắt cron để tránh phụ thuộc Redis):

```bash
cd version_2.0/projects/api_verveo
ENABLE_CRON=false SERVICE_ROLE_TOKEN=localtest npm run dev
```

- DB đã migrate:

```bash
npm run run-migration 007_add_app_themes.sql
```

- Có user đã **verify email** để login bằng `/auth/login`.
- Lấy JWT theo file: `TEST_AUTH_GET_TOKEN_LOCAL.md` (copy token vào biến `JWT` bên dưới).
- Để gọi `POST/DELETE /app/themes`, cần quyền admin/service:
  - **Service role** (khuyến nghị khi test): set `SERVICE_ROLE_TOKEN=localtest` và gửi header `X-SERVICE-TOKEN: localtest`
  - Hoặc set `ADMIN_USER_IDS=<yourUserId>` (nếu muốn dùng user-based admin)

---

## 1) Set variables

Set biến môi trường:

```bash
BASE="http://localhost:8000"
SERVICE_TOKEN="localtest"
JWT="<PASTE_JWT_HERE>"
```

---

## 2) Test lấy themes

```bash
curl -sS "$BASE/app/themes" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); console.log({status:j.status, version:j.data?.version, themesCount:j.data?.themes?.length});});'
```

---

## 3) Test POST theme (auto blurHash)

### 3.1 Chuẩn bị `imgUrl` (HTTPS)

Ví dụ Firebase Storage (có `alt=media&token=...`):

```bash
IMGURL="https://firebasestorage.googleapis.com/v0/b/verveo-5a802.firebasestorage.app/o/backgrounds%2Fimg_morning_track_glow.png?alt=media&token=c8e8c0f0-f812-4a75-8dda-e9acc21f8255"
```

### 3.2 POST

```bash
THEME_ID="local_theme_e2e_1"

curl -sS -X POST "$BASE/app/themes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -H "X-SERVICE-TOKEN: $SERVICE_TOKEN" \
  -d "{
    \"id\":\"$THEME_ID\",
    \"name\":\"Local Theme E2E 1\",
    \"calendarCategory\":\"backgrounds\",
    \"calendarCategoryDisplay\":\"Backgrounds\",
    \"imgUrl\":\"$IMGURL\",
    \"calendarMonthlyView\":{\"monthTitleColor\":4294967295,\"dayOfWeekColor\":4294967295,\"dayNumberColor\":4294967295,\"dayLunarNumberColor\":4294967295,\"isStatusDark\":false},
    \"calendarWeeklyView\":{\"weekTitleColor\":4294967295,\"dayLabelColor\":4294967295,\"timelineHourColor\":4294967295,\"eventTitleColor\":4294967295,\"eventTimeColor\":4294967295},
    \"homeView\":{\"headerText\":4294967295,\"isStatusDark\":false}
  }" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.status!==0){console.error(j); process.exit(2);} console.log({status:j.status, id:j.data.theme.id, hasBlurHash:!!j.data.theme.blurHash, blurHashLen:j.data.theme.blurHash?.length});});'
```

Kỳ vọng:
- `hasBlurHash: true`

---

## 4) Test xoá theme

```bash
curl -sS -X DELETE "$BASE/app/themes/$THEME_ID" \
  -H "Authorization: Bearer $JWT" \
  -H "X-SERVICE-TOKEN: $SERVICE_TOKEN" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.status!==0){console.error(j); process.exit(2);} console.log({status:j.status, deletedId:j.data.deletedId, version:j.data.version});});'
```

---

## (Optional) Case lỗi bắt buộc `imgUrl`

```bash
curl -sS -X POST "$BASE/app/themes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -H "X-SERVICE-TOKEN: $SERVICE_TOKEN" \
  -d "{\"id\":\"missing_img\",\"name\":\"x\",\"calendarCategory\":\"x\",\"calendarCategoryDisplay\":\"x\",\"calendarMonthlyView\":{},\"calendarWeeklyView\":{},\"homeView\":{}}" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); console.log({status:j.status, errorKey:j.errorKey, message:j.message});});'
```

Kỳ vọng:
- `message: "imgUrl is required"`

