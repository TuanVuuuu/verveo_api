// Simple console logger with timestamps
class Logger {
  private formatTime(): string {
    return new Date().toISOString();
  }

  info(message: string, ...args: any[]): void {
    console.log(`[${this.formatTime()}] [INFO]`, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.formatTime()}] [ERROR]`, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.formatTime()}] [WARN]`, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${this.formatTime()}] [DEBUG]`, message, ...args);
    }
  }
}

export const logger = new Logger();
