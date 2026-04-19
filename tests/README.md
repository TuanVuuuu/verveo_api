# API tests (Node scripts)

Các script trong folder này dùng để test nhanh API local/VPS bằng Node (có sẵn `fetch`).

## Cấu hình

Các script **không dùng `.env`**. Bạn sửa trực tiếp các hằng số ở đầu file:

- `tests/01_get_jwt.mjs`: `BASE_URL`, `EMAIL`, `PASSWORD`
- `tests/02_themes_e2e.mjs`: `BASE_URL`, `EMAIL`, `PASSWORD`, `SERVICE_TOKEN`, `IMG_URL`

## Chạy

### 1) Lấy JWT (in token ra stdout)

```bash
node tests/01_get_jwt.mjs
```

### 2) Test themes end-to-end

```bash
node tests/02_themes_e2e.mjs
```

