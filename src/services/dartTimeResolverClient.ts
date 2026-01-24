import { logger } from '../utils/logger.js';

export interface ResolvedTime {
  startTime: string;
  endTime: string;
}

interface DartResolveRequest {
  timeHint: string;
  durationHours: number;
  now?: number; // timestamp in milliseconds
}

interface DartResolveResponse {
  startTime: string; // ISO 8601 format hoặc YYYY-MM-DD HH:mm:ss
  endTime: string;   // ISO 8601 format hoặc YYYY-MM-DD HH:mm:ss
  confidence?: number;
  extractedInfo?: Record<string, any>;
}

export class DartTimeResolverClient {
  private dartServiceUrl: string;
  private timeout: number;
  private enabled: boolean;

  constructor(
    dartServiceUrl = process.env.DART_SERVICE_URL || 'http://localhost:8081',
    timeout = 5000, // 5 seconds
    enabled = process.env.USE_DART_SERVICE === 'true'
  ) {
    this.dartServiceUrl = dartServiceUrl;
    this.timeout = timeout;
    this.enabled = enabled;
  }

  async resolve(
    timeHint: string,
    durationHours = 2,
    now = new Date()
  ): Promise<ResolvedTime | null> {
    if (!this.enabled) {
      logger.warn('[DartTimeResolver] Service is DISABLED');
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const request: DartResolveRequest = {
        timeHint,
        durationHours,
        now: now.getTime(),
      };

      logger.info('[DartTimeResolver] Calling Dart service', {
        url: `${this.dartServiceUrl}/resolve`,
        request: {
          timeHint,
          durationHours,
          now: now.toISOString(),
          nowTimestamp: now.getTime()
        }
      });

      const response = await fetch(`${this.dartServiceUrl}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.error(`[DartTimeResolver] Dart service returned status ${response.status}`);
        return null;
      }

      const data: DartResolveResponse = await response.json();
      
      logger.info('[DartTimeResolver] Dart service RAW response', {
        rawStartTime: data.startTime,
        rawEndTime: data.endTime,
        format: typeof data.startTime,
        confidence: data.confidence,
        extractedInfo: data.extractedInfo
      });

      // Ưu tiên dùng timestamp từ Dart service (chính xác hơn, đã đúng timezone)
      let startTime: string;
      let endTime: string;

      if (data.extractedInfo?.startTimeMs && data.extractedInfo?.endTimeMs) {
        // Dùng timestamp từ Dart service (đã đúng timezone UTC+7)
        const startDate = new Date(data.extractedInfo.startTimeMs);
        const endDate = new Date(data.extractedInfo.endTimeMs);
        startTime = this.formatDateTime(startDate);
        endTime = this.formatDateTime(endDate);
        
        logger.info('[DartTimeResolver] ✅ Using timestamp from extractedInfo (more accurate)', {
          startTimeMs: data.extractedInfo.startTimeMs,
          endTimeMs: data.extractedInfo.endTimeMs,
          startTime,
          endTime,
          startTimeISO: startDate.toISOString(),
          endTimeISO: endDate.toISOString()
        });
      } else {
        // Fallback: parse từ string (có thể có vấn đề timezone)
        logger.warn('[DartTimeResolver] ⚠️ No timestamp in extractedInfo, using string parsing (may have timezone issues)');
        startTime = this.convertToFormat(data.startTime);
        endTime = this.convertToFormat(data.endTime);
      }

      const result = {
        startTime,
        endTime,
      };

      logger.info('[DartTimeResolver] After conversion', {
        startTime: result.startTime,
        endTime: result.endTime,
        startTimeParsed: new Date(result.startTime).toISOString(),
        endTimeParsed: new Date(result.endTime).toISOString()
      });

      return result;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          logger.error('[DartTimeResolver] Request timed out');
        } else {
          logger.error('[DartTimeResolver] Error calling Dart service', {
            error: error.message,
            stack: error.stack
          });
        }
      }
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.dartServiceUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Convert time string từ Dart service sang format YYYY-MM-DD HH:mm:ss
   * Hỗ trợ cả ISO 8601 format và format YYYY-MM-DD HH:mm:ss
   * Đảm bảo timezone được xử lý đúng (UTC+7)
   */
  private convertToFormat(timeString: string): string {
    try {
      // Nếu đã là format YYYY-MM-DD HH:mm:ss, kiểm tra và trả về
      const formatMatch = timeString.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
      if (formatMatch) {
        // Validate và format lại để đảm bảo consistency
        const [, year, month, day, hour, minute, second] = formatMatch;
        const pad = (n: number) => n.toString().padStart(2, '0');
        
        // Parse như local time (UTC+7) và tạo Date object
        const date = new Date(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(minute, 10),
          parseInt(second, 10)
        );
        
        // Format lại để đảm bảo đúng
        return `${year}-${pad(parseInt(month, 10))}-${pad(parseInt(day, 10))} ${pad(parseInt(hour, 10))}:${pad(parseInt(minute, 10))}:${pad(parseInt(second, 10))}`;
      }

      // Nếu là ISO 8601 format, parse và convert
      const date = new Date(timeString);
      
      // Kiểm tra date hợp lệ
      if (isNaN(date.getTime())) {
        logger.error('[DartTimeResolver] Invalid date string', { timeString });
        throw new Error('Invalid date string');
      }

      const pad = (n: number) => n.toString().padStart(2, '0');
      
      // Lấy local time components (UTC+7)
      const y = date.getFullYear();
      const m = pad(date.getMonth() + 1);
      const d = pad(date.getDate());
      const hh = pad(date.getHours());
      const mm = pad(date.getMinutes());
      const ss = pad(date.getSeconds());
      
      const result = `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
      
      logger.debug('[DartTimeResolver] Converted time', {
        input: timeString,
        output: result,
        isoString: date.toISOString(),
        localString: date.toString()
      });
      
      return result;
    } catch (error) {
      logger.error('[DartTimeResolver] Error converting time format', {
        timeString,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Format Date object thành string YYYY-MM-DD HH:mm:ss (UTC+7)
   * Timestamp từ Dart service đã là UTC, cần convert sang UTC+7 để format
   */
  private formatDateTime(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    // Convert từ UTC sang UTC+7 (thêm 7 giờ)
    const utc7Date = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    
    // Lấy UTC components (sau khi đã +7 giờ)
    const y = utc7Date.getUTCFullYear();
    const m = pad(utc7Date.getUTCMonth() + 1);
    const d = pad(utc7Date.getUTCDate());
    const hh = pad(utc7Date.getUTCHours());
    const mm = pad(utc7Date.getUTCMinutes());
    const ss = pad(utc7Date.getUTCSeconds());
    
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

