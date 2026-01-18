# Hướng dẫn implement logic thực tế trong Dart Service

## 📋 Current Status

Hiện tại `bin/server.dart` đang dùng **mock data**. Bạn cần thay thế bằng logic thực tế từ `one_extract_task`.

## 🔧 Steps to Implement

### Step 1: Kiểm tra API của `one_extract_task`

Trước tiên, xem cấu trúc của library:

```bash
# Clone repo (nếu chưa có)
cd /tmp
git clone https://github.com/TuanVuuuu/one_extract_task.git
cd one_extract_task

# Xem cấu trúc
ls -la lib/

# Đọc README và examples
cat README.md
cat lib/one_extract_task.dart
```

### Step 2: Xác định main API method

Tìm method chính để resolve time. Ví dụ có thể là:

```dart
// Có thể là một trong các signatures này:
TaskResult extractTask(String input);
TimeInfo resolveTime(String timeHint, DateTime now);
ParsedTask parseTask(String prompt, {DateTime? now, int? duration});
```

### Step 3: Update `pubspec.yaml` (Đã xong)

File đã được config sẵn:

```yaml
dependencies:
  one_extract_task:
    git:
      url: https://github.com/TuanVuuuu/one_extract_task.git
      ref: main
```

### Step 4: Import và sử dụng trong server.dart

Mở file `bin/server.dart` và update:

```dart
import 'dart:convert';
import 'dart:io';

import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart';
import 'package:shelf_router/shelf_router.dart';

// ✅ Uncomment và import one_extract_task
import 'package:one_extract_task/one_extract_task.dart';

// ... rest of code ...

Future<Response> _resolveHandler(Request request) async {
  try {
    final payload = await request.readAsString();
    final data = jsonDecode(payload) as Map<String, dynamic>;
    
    final timeHint = data['timeHint'] as String? ?? '';
    final durationHours = data['durationHours'] as int? ?? 2;
    final nowTimestamp = data['now'] as int?;
    
    final now = nowTimestamp != null 
        ? DateTime.fromMillisecondsSinceEpoch(nowTimestamp)
        : DateTime.now();
    
    // ✅ THAY THẾ MOCK BẰNG CODE THỰC TẾ
    // Tùy thuộc vào API của one_extract_task, có thể là:
    
    // Option 1: Nếu có method extractTask
    final taskResult = extractTask(timeHint, now: now, duration: durationHours);
    final result = {
      'startTime': taskResult.startTime.toIso8601String(),
      'endTime': taskResult.endTime.toIso8601String(),
      'confidence': taskResult.confidence ?? 0.9,
      'extractedInfo': {
        'timeHint': taskResult.timeHint,
        'durationHours': durationHours,
      }
    };
    
    // Option 2: Nếu có class TimeResolver
    // final resolver = TimeResolver();
    // final resolvedTime = resolver.resolve(timeHint, now, durationHours);
    // final result = { ... };
    
    // Option 3: Nếu có static method
    // final resolvedTime = OneExtractTask.resolve(timeHint, now: now);
    // final result = { ... };
    
    return Response.ok(
      jsonEncode(result),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    );
  } catch (e, stackTrace) {
    print('Error resolving time: $e');
    print('Stack trace: $stackTrace');
    
    return Response.internalServerError(
      body: jsonEncode({
        'error': 'Failed to resolve time',
        'message': e.toString(),
      }),
      headers: {'Content-Type': 'application/json'},
    );
  }
}
```

### Step 5: Test locally

```bash
# Terminal 1: Run Dart service
cd dart_time_service
dart pub get
dart run bin/server.dart

# Terminal 2: Test với curl
curl -X POST http://localhost:8081/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "timeHint": "tối nay đi ăn lẩu",
    "durationHours": 2,
    "now": 1737192600000
  }'
```

Expected response:
```json
{
  "startTime": "2026-01-18T21:00:00.000Z",
  "endTime": "2026-01-18T23:00:00.000Z",
  "confidence": 0.95
}
```

### Step 6: Test với NodeJS integration

```bash
cd ../api_verveo
npm run build
USE_DART_SERVICE=true npm run test-cases
```

## 📝 Common API Patterns trong Dart Libraries

### Pattern 1: Simple function

```dart
import 'package:one_extract_task/one_extract_task.dart';

final result = parseTimeHint('tối nay', DateTime.now());
print(result.startTime);
```

### Pattern 2: Class-based

```dart
import 'package:one_extract_task/one_extract_task.dart';

final extractor = TaskExtractor();
final result = extractor.extract('tối nay đi ăn lẩu');
print(result.timeInfo.startTime);
```

### Pattern 3: Static method

```dart
import 'package:one_extract_task/one_extract_task.dart';

final result = OneExtractTask.parse('tối nay', now: DateTime.now());
```

### Pattern 4: Builder pattern

```dart
import 'package:one_extract_task/one_extract_task.dart';

final result = TaskBuilder()
  .withPrompt('tối nay đi ăn lẩu')
  .withNow(DateTime.now())
  .withDuration(Duration(hours: 2))
  .build();
```

## 🔍 How to Find the Correct API

### Method 1: Read the source code

```bash
cd /tmp/one_extract_task
cat lib/one_extract_task.dart
```

Look for:
- `export` statements
- Public classes
- Main methods with documentation

### Method 2: Check examples

```bash
cat example/main.dart
cat test/*_test.dart
```

### Method 3: Check README

```bash
cat README.md
```

Usually có usage examples.

### Method 4: Use Dart analyzer

```dart
// In bin/server.dart, type:
import 'package:one_extract_task/one_extract_task.dart';

// Then Ctrl+Space to see autocomplete suggestions
```

## ⚠️ Important Notes

1. **Error Handling**: Wrap trong try-catch để tránh crash server
2. **Timezone**: Đảm bảo convert đúng timezone (Vietnam = GMT+7)
3. **Date Format**: NodeJS expect format `YYYY-MM-DD HH:mm:ss`, Dart trả về ISO 8601
4. **Validation**: Validate input trước khi process
5. **Logging**: Log errors để dễ debug

## 🐛 Troubleshooting

### Issue: "The method 'xxx' isn't defined"

**Solution**: API name không đúng, check lại source code của `one_extract_task`

### Issue: "Type mismatch"

**Solution**: Convert types đúng cách:

```dart
// DateTime to milliseconds
final timestamp = dateTime.millisecondsSinceEpoch;

// Milliseconds to DateTime
final dateTime = DateTime.fromMillisecondsSinceEpoch(timestamp);

// ISO 8601 string
final isoString = dateTime.toIso8601String();
```

### Issue: "Package not found"

**Solution**:
```bash
dart pub cache clean
dart pub get
```

## 📞 Next Steps

1. ✅ Clone `one_extract_task` repo
2. ✅ Đọc documentation và examples
3. ✅ Xác định correct API method
4. ✅ Update `bin/server.dart`
5. ✅ Test với curl
6. ✅ Test với NodeJS integration
7. ✅ Compare kết quả với TypeScript implementation

Nếu gặp khó khăn, hãy:
- Post code snippet của `one_extract_task/lib/one_extract_task.dart`
- Share error messages
- Tôi sẽ giúp implement chính xác

