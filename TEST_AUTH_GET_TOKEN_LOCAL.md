# Test Auth: Login → Get JWT (Local)

Mục tiêu: đăng nhập và lấy JWT để test các API cần `Authorization: Bearer <JWT>`.

---

## Preconditions

- Server đang chạy local: `http://localhost:8000`
- User đã **verify email** (vì `/auth/login` sẽ chặn nếu `is_verified=false`)

---

## 1) Set variables

Thay email/password của bạn:

```bash
BASE="http://localhost:8000"
EMAIL="tuanvuanbai@gmail.com"
PASSWORD="<YOUR_PASSWORD>"
```

---

## 2) Login và lấy JWT

```bash
JWT="$(
  curl -sS -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.status!==0){console.error(j); process.exit(2);} console.log(j.data.token);});'
)"

echo "JWT=${JWT:0:20}..."
```

Nếu cần copy cả token:

```bash
echo "$JWT"
```

