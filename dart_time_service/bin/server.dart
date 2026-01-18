import 'dart:convert';
import 'dart:io';

import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart';
import 'package:shelf_router/shelf_router.dart';
import 'package:one_extract_task/one_extract_task.dart';

// Configure routes.
final _router = Router()
  ..get('/', _rootHandler)
  ..post('/resolve', _resolveHandler)
  ..get('/health', _healthHandler);

Response _rootHandler(Request req) {
  return Response.ok(
    jsonEncode({
      'service': 'Dart Time Resolution Service',
      'version': '1.0.0',
      'status': 'running',
    }),
    headers: {'Content-Type': 'application/json'},
  );
}

Response _healthHandler(Request req) {
  return Response.ok(
    jsonEncode({
      'status': 'healthy',
      'timestamp': DateTime.now().toIso8601String(),
    }),
    headers: {'Content-Type': 'application/json'},
  );
}

Future<Response> _resolveHandler(Request request) async {
  try {
    // Parse request body
    final payload = await request.readAsString();
    final data = jsonDecode(payload) as Map<String, dynamic>;

    final timeHint = data['timeHint'] as String? ?? '';
    final durationHours = data['durationHours'] as int? ?? 2;
    final nowTimestamp = data['now'] as int?;

    final now = nowTimestamp != null
        ? DateTime.fromMillisecondsSinceEpoch(nowTimestamp)
        : DateTime.now();

    // ✅ Use actual one_extract_task logic
    final aiResult = OETExtractTask.extract(timeHint, now);

    if (aiResult == null) {
      // Extract failed, return default time (1 hour from now)
      final defaultStart = now.add(Duration(hours: 1));
      final defaultEnd = defaultStart.add(Duration(hours: durationHours));

      final result = {
        'startTime': _formatDateTime(defaultStart),
        'endTime': _formatDateTime(defaultEnd),
        'confidence': 0.0,
        'error': 'Failed to extract time from hint',
        'extractedInfo': {
          'timeHint': timeHint,
          'durationHours': durationHours,
          'usedDefault': true,
        },
      };

      return Response.ok(
        jsonEncode(result),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      );
    }

    // Successfully extracted task info
    final startTime = DateTime.fromMillisecondsSinceEpoch(aiResult.startTime);
    final endTime = DateTime.fromMillisecondsSinceEpoch(aiResult.endTime);
    final dueTime = DateTime.fromMillisecondsSinceEpoch(aiResult.due);

    final result = {
      'startTime': _formatDateTime(startTime),
      'endTime': _formatDateTime(endTime),
      'confidence': 0.95, // High confidence from one_extract_task
      'extractedInfo': {
        'title': aiResult.title,
        'timeHint': timeHint,
        'durationHours': durationHours,
        'labels': aiResult.labels,
        'priority': aiResult.priority,
        'progress': aiResult.progress,
        'categories': aiResult.categories,
        'due': _formatDateTime(dueTime),
        'startTimeMs': aiResult.startTime,
        'endTimeMs': aiResult.endTime,
        'dueMs': aiResult.due,
      },
    };

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

/// Format DateTime to NodeJS expected format: YYYY-MM-DD HH:mm:ss
String _formatDateTime(DateTime dt) {
  String pad(int n) => n.toString().padLeft(2, '0');

  final y = dt.year;
  final m = pad(dt.month);
  final d = pad(dt.day);
  final hh = pad(dt.hour);
  final mm = pad(dt.minute);
  final ss = pad(dt.second);

  return '$y-$m-$d $hh:$mm:$ss';
}

void main(List<String> args) async {
  // Use any available host or container IP (usually `0.0.0.0`).
  final ip = InternetAddress.anyIPv4;

  // Configure a pipeline that logs requests.
  final handler = Pipeline()
      .addMiddleware(logRequests())
      .addMiddleware(_cors())
      .addHandler(_router.call);

  // For running in containers, we respect the PORT environment variable.
  final port = int.parse(Platform.environment['PORT'] ?? '8081');
  final server = await serve(handler, ip, port);
  print('🚀 Dart Time Service listening on port ${server.port}');
  print('📍 Health check: http://localhost:${server.port}/health');
  print('📍 Resolve endpoint: POST http://localhost:${server.port}/resolve');
}

// CORS middleware
Middleware _cors() {
  return (Handler handler) {
    return (Request request) async {
      if (request.method == 'OPTIONS') {
        return Response.ok(
          '',
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers':
                'Origin, Content-Type, Accept, Authorization',
          },
        );
      }

      final response = await handler(request);
      return response.change(
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers':
              'Origin, Content-Type, Accept, Authorization',
        },
      );
    };
  };
}
