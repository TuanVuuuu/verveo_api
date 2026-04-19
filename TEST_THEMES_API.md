# Test Themes API (curl/Postman)

## 0) Preconditions

- Server đang chạy (ví dụ `http://localhost:8000`)
- Đã chạy migration:
  - `npm run run-migration 007_add_app_themes.sql`
- Có JWT hợp lệ (`<JWT>`)
- Có quyền admin/service để gọi POST/DELETE:
  - Option A: set `ADMIN_USER_IDS=<yourUserId>` trong `.env`
  - Option B: set `SERVICE_ROLE_TOKEN=<token>` và gửi header `X-SERVICE-TOKEN: <token>`

---

## 1) GET /app/themes

```bash
curl -sS -X GET "http://localhost:8000/app/themes"
```

Expected: `status=0`, `data.version`, `data.themes[]`

---

## 2) GET /app/themes/:id

```bash
curl -sS -X GET "http://localhost:8000/app/themes/spring_promo_2026"
```

Expected: `status=0`, `data.theme`, `data.version`

---

## 3) POST /app/themes (admin/service)

### 3.1 Minimal body (imgUrl required, blurHash optional)

```bash
curl -sS -X POST "http://localhost:8000/app/themes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT>" \
  -H "X-SERVICE-TOKEN: <SERVICE_ROLE_TOKEN>" \
  -d '{
    "id": "spring_promo_2026",
    "name": "Spring promo",
    "calendarCategory": "seasonal",
    "calendarCategoryDisplay": "Seasonal",
    "imgUrl": "https://firebasestorage.googleapis.com/v0/b/<bucket>/o/themes%2Fspring_promo_2026%2Fbg.webp?alt=media&token=<token>",
    "calendarMonthlyView": {
      "monthTitleColor": 4294967295,
      "dayOfWeekColor": 4294967295,
      "dayNumberColor": 4294967295,
      "dayLunarNumberColor": 4294967295,
      "isStatusDark": false
    },
    "calendarWeeklyView": {
      "weekTitleColor": 4294967295,
      "dayLabelColor": 4294967295,
      "timelineHourColor": 4294967295,
      "eventTitleColor": 4294967295,
      "eventTimeColor": 4294967295
    },
    "homeView": {
      "headerText": 4294967295,
      "isStatusDark": false
    }
  }'
```

Expected:
- `status=0`
- `data.theme.blurHash` sẽ được BE tự generate nếu bạn không truyền.
- (Backward-compatible) BE cũng sẽ fill `data.theme.*View.blurHash` nếu thiếu.

### 3.2 Case lỗi: thiếu imgUrl

Nếu thiếu `imgUrl` ở top-level (và không gửi `imgUrl` trong view) → lỗi `error.request.invalid` với message `imgUrl is required`.

---

## 4) DELETE /app/themes/:id (admin/service)

```bash
curl -sS -X DELETE "http://localhost:8000/app/themes/spring_promo_2026" \
  -H "Authorization: Bearer <JWT>" \
  -H "X-SERVICE-TOKEN: <SERVICE_ROLE_TOKEN>"
```

Expected: `status=0`, `data.deletedId`, `data.version`

