# Dart Time Resolution Service

Microservice sử dụng `one_extract_task` library để xử lý time resolution cho backend NodeJS.

## 📋 Yêu cầu

- Dart SDK >= 3.8.0
- Git (để clone one_extract_task từ GitHub)

## 🚀 Setup

### 1. Cài đặt dependencies

```bash
cd /Users/nguyentuanvu/dev/BE/test_ai/version_2.0/projects/dart_time_service
dart pub get
```

### 2. Update `bin/server.dart` với logic thực tế

Hiện tại server đang dùng mock data. Bạn cần:

```dart
// Uncomment dòng này ở đầu file
import 'package:one_extract_task/one_extract_task.dart';

// Thay thế mock logic trong _resolveHandler bằng:
final result = OneExtractTask.resolve(timeHint, durationHours, now);
```

### 3. Chạy service

```bash
# Development mode
dart run bin/server.dart

# Production mode (với port custom)
PORT=8081 dart run bin/server.dart
```

Server sẽ chạy tại: http://localhost:8081

## 📡 API Endpoints

### Health Check

```bash
GET http://localhost:8081/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-18T10:30:00.000Z"
}
```

### Resolve Time

```bash
POST http://localhost:8081/resolve
Content-Type: application/json

{
  "timeHint": "tối nay đi ăn lẩu",
  "durationHours": 2,
  "now": 1737192600000
}
```

Response:
```json
{
  "startTime": "2026-01-18T21:00:00.000Z",
  "endTime": "2026-01-18T23:00:00.000Z",
  "confidence": 0.95,
  "extractedInfo": {
    "timeHint": "tối nay đi ăn lẩu",
    "durationHours": 2
  }
}
```

## 🔧 Tích hợp với NodeJS Backend

### Enable Dart Service

Thêm vào `.env`:

```env
USE_DART_SERVICE=true
DART_SERVICE_URL=http://localhost:8081
```

### Test Integration

```bash
cd ../api_verveo

# Compile TypeScript
npm run build

# Test với Dart service enabled
USE_DART_SERVICE=true npm run test-cases
```

## 🏗️ Kiến trúc

```
┌─────────────────┐      HTTP POST      ┌──────────────────────┐
│  NodeJS API     │ ─────────────────→  │  Dart Service        │
│  (Port 3000)    │                      │  (Port 8081)         │
│                 │ ←───────────────────│                      │
│  Hybrid         │   JSON Response      │  one_extract_task    │
│  TimeResolver   │                      │  library             │
└─────────────────┘                      └──────────────────────┘
        │                                          │
        │ Fallback (if Dart fails)                │
        ↓                                          │
┌─────────────────┐                               │
│  TypeScript     │                               │
│  TimeResolver   │                               │
│  (Backup)       │                               │
└─────────────────┘                               │
                                                   │
                                    ┌──────────────┴───────────┐
                                    │  Flutter Mobile App      │
                                    │  (Uses same library)     │
                                    └──────────────────────────┘
```

## 🎯 Lợi ích

1. **Đồng bộ logic**: BE và Mobile cùng dùng một implementation
2. **Dễ maintain**: Fix bug ở một chỗ, cả hai platform đều được cập nhật
3. **Fallback**: NodeJS vẫn có backup implementation nếu Dart service down
4. **Performance**: Dart service xử lý nhanh hơn TypeScript với regex phức tạp
5. **Testing**: Test một lần trên Dart, chạy trên cả hai platform

## 📝 TODO

- [ ] Thay mock data bằng logic thực tế từ `one_extract_task`
- [ ] Add Docker support cho production deployment
- [ ] Add monitoring và logging
- [ ] Add rate limiting
- [ ] Add caching layer
- [ ] Setup CI/CD pipeline

## 🐛 Troubleshooting

### Dart service không start được

```bash
# Check Dart version
dart --version

# Reinstall dependencies
dart pub get --offline
dart pub cache repair
dart pub get
```

### NodeJS không connect được Dart service

```bash
# Check service health
curl http://localhost:8081/health

# Check logs
dart run bin/server.dart
```

### Performance issues

- Tăng timeout trong NodeJS client (mặc định 5s)
- Check Dart service logs
- Monitor memory usage

## 📚 References

- [one_extract_task library](https://github.com/TuanVuuuu/one_extract_task)
- [Shelf Framework](https://pub.dev/packages/shelf)
- [Dart HTTP Server](https://dart.dev/tutorials/server/httpserver)
