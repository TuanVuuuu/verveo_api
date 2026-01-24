import { DartTimeResolverClient, ResolvedTime } from './dartTimeResolverClient.js';
import { logger } from '../utils/logger.js';

/**
 * Time Resolver Service - Uses Dart service (one_extract_task) only
 */
export class HybridTimeResolverService {
  private dartClient: DartTimeResolverClient;

  constructor() {
    this.dartClient = new DartTimeResolverClient();
  }

  async resolve(
    timeHint: string,
    durationHours = 2,
    now = new Date()
  ): Promise<ResolvedTime> {
    logger.info('[HybridTimeResolver] Resolve called', {
      timeHint,
      durationHours,
      now: now.toISOString(),
      nowLocal: now.toString()
    });

    const dartResult = await this.dartClient.resolve(timeHint, durationHours, now);
    
    if (dartResult) {
      logger.info('[HybridTimeResolver] ✅ Used Dart service (one_extract_task) for time resolution', {
        startTime: dartResult.startTime,
        endTime: dartResult.endTime,
        startTimeISO: new Date(dartResult.startTime).toISOString(),
        endTimeISO: new Date(dartResult.endTime).toISOString()
      });
      return dartResult;
    }

    // Return default time if Dart service fails
    logger.warn('[HybridTimeResolver] ❌ Dart service failed, using FALLBACK');
    const startTime = new Date(now);
    startTime.setHours(startTime.getHours() + 1);
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + durationHours);
    
    const fallbackResult = {
      startTime: this.formatDateTime(startTime),
      endTime: this.formatDateTime(endTime),
    };

    logger.warn('[HybridTimeResolver] Fallback time result', {
      startTime: fallbackResult.startTime,
      endTime: fallbackResult.endTime,
      startTimeISO: startTime.toISOString(),
      endTimeISO: endTime.toISOString()
    });

    return fallbackResult;
  }

  private formatDateTime(dt: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const y = dt.getFullYear();
    const m = pad(dt.getMonth() + 1);
    const d = pad(dt.getDate());
    const hh = pad(dt.getHours());
    const mm = pad(dt.getMinutes());
    const ss = pad(dt.getSeconds());
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  async checkDartServiceHealth(): Promise<boolean> {
    return this.dartClient.healthCheck();
  }

  enableDartService(enabled: boolean): void {
    this.dartClient.setEnabled(enabled);
  }
}

