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
  startTime: string; // ISO 8601 format
  endTime: string;   // ISO 8601 format
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
        console.error(`Dart service returned status ${response.status}`);
        return null;
      }

      const data: DartResolveResponse = await response.json();

      // Convert ISO 8601 to our format (YYYY-MM-DD HH:mm:ss)
      return {
        startTime: this.convertIsoToFormat(data.startTime),
        endTime: this.convertIsoToFormat(data.endTime),
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('Dart service request timed out');
        } else {
          console.error('Error calling Dart service:', error.message);
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

  private convertIsoToFormat(isoString: string): string {
    const date = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

