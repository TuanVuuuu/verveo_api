# Verveo Todo Generator API (Node.js)

API thông minh sử dụng DeepSeek AI (qua OpenRouter) để tạo todo items từ prompt. Luôn trả về thời gian cụ thể với `startTime` và `endTime`.

## 🚀 Cài đặt nhanh

```bash
# 1. Vào thư mục dự án
cd projects/api_verveo

# 2. Cài đặt dependencies
npm i  # hoặc: pnpm i / yarn

# 3. Cấu hình OpenRouter API key
export OPENROUTER_API_KEY="your_openrouter_api_key_here"

# 4. Chạy dev server
npm run dev  # hoặc: pnpm dev / yarn dev
```

Server mặc định chạy tại `http://0.0.0.0:8000`.

## 🔑 Environment Variables

Tạo file `.env`:

```bash
# Bắt buộc
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Environment
NODE_ENV=production  # Mặc định là production

# Tùy chọn - API Configuration
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
DEEPSEEK_MODEL=deepseek/deepseek-v3.1-terminus
API_TIMEOUT=30000
MAX_TOKENS=500
TEMPERATURE=0.7
TOP_P=0.9

# Tùy chọn - Application
APP_TITLE=Verveo Todo Generator API (Node)
APP_VERSION=2.0.4
APP_DESCRIPTION=API thông minh để tạo todo từ prompt sử dụng DeepSeek AI

# Tùy chọn - Server
HOST=0.0.0.0
PORT=8000
```

**Lưu ý về Manual Plan**:
- Manual plan luôn được phép update qua `PUT /auth/profile`
- Không cần config gì thêm, có thể set plan bất cứ lúc nào

## 📋 API Endpoints

### 1. GET `/ping`
```bash
curl http://localhost:8000/ping
```

### 2. GET `/health`
```bash
curl http://localhost:8000/health
```

### 3. POST `/gen_todo`
```bash
curl -X POST "http://localhost:8000/gen_todo" \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Học tiếng anh trong 2 tiếng vào tối nay"}'
```

## 🏗️ Kiến trúc (Clean Architecture)

```
src/
├── index.ts               # Express routes & HTTP handling
├── services/
│   ├── aiService.ts       # AI integration (OpenRouter + DeepSeek)
│   └── healthService.ts   # Health checks & system info
└── utils/
    └── datetime.ts        # Helpers format & time calculations
```

## 🧪 Scripts

```bash
npm run dev     # chạy dev bằng tsx watch
npm run build   # build TypeScript -> dist
npm start       # chạy dist/index.js
```

## 🐳 Docker (tùy chọn)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json .
RUN npm i --omit=dev
COPY src ./src
RUN npm run build
EXPOSE 8000
CMD ["node", "dist/index.js"]
```

## 🔧 Troubleshooting
- OpenRouter API key not found: set biến `OPENROUTER_API_KEY` hoặc thêm vào `.env`.
- ECONNREFUSED / 401 / 429: kiểm tra key, quota và rate limit OpenRouter.
- Port bận: đổi `PORT` trong `.env`.

## 📄 License
MIT
