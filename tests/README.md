# API tests (Node scripts)

## Scripts

- `01_get_jwt.mjs` — login, in JWT ra stdout
- `02_themes_e2e.mjs` — test `GET /app/themes` và `GET /app/themes/:id` (public, không cần JWT)

## Cấu hình

Sửa hằng số ở đầu từng file (`BASE_URL`, `EMAIL`, `PASSWORD`, `THEME_ID`).

Server cần có env:

```env
THEME_CATALOG_JSON_URL=https://raw.githubusercontent.com/TuanVuuuu/vplans-ai-data/main/themes.json
```

## Chạy

```bash
node tests/01_get_jwt.mjs
node tests/02_themes_e2e.mjs
```
