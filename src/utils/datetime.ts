import { LunarDate, SolarDate } from '@nghiavuive/lunar_date_vi';

export class DateTime {
  static format(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  static weekdayVi(date: Date): string {
    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    // JS: 0 = Sunday
    return weekdays[date.getDay()];
  }

  static offsetHours(hours: number): string {
    const now = new Date();
    now.setHours(now.getHours() + hours);
    return DateTime.format(now);
    }

  static offsetHoursFrom(startTime: string, hours: number): string {
    try {
      const [datePart, timePart] = startTime.split(' ');
      const [y, m, d] = datePart.split('-').map((v) => parseInt(v, 10));
      const [hh, mm, ss] = timePart.split(':').map((v) => parseInt(v, 10));
      const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, ss || 0);
      dt.setHours(dt.getHours() + hours);
      return DateTime.format(dt);
    } catch {
      return DateTime.offsetHours(3);
    }
  }

  static convertLunarToSolar(lunarYear: number, lunarMonth: number, lunarDay: number): Date | null {
    try {
      const lunarDate = new LunarDate({ year: lunarYear, month: lunarMonth, day: lunarDay });
      const solarDate = lunarDate.toSolarDate();
      const solarData = solarDate.get();
      return new Date(solarData.year, solarData.month - 1, solarData.day);
    } catch {
      return null;
    }
  }

  static getCurrentLunarDate(): { year: number; month: number; day: number } | null {
    try {
      const now = new Date();
      const solarDate = new SolarDate(now);
      const lunarDate = solarDate.toLunarDate();
      const lunarData = lunarDate.get();
      return {
        year: lunarData.year,
        month: lunarData.month,
        day: lunarData.day
      };
    } catch {
      return null;
    }
  }

  /**
   * Convert Date to timestamp (milliseconds, UTC-based)
   * Timestamp represents milliseconds since Unix epoch (UTC).
   * Client apps (Flutter/web) MUST parse it as UTC and then convert to local time when displaying.
   */
  static toTimestamp(date: Date | null | undefined): number | null {
    if (!date) return null;
    return date.getTime();
  }

  /**
   * Parse timestamp (milliseconds) to Date object.
   * The number is assumed to be milliseconds since Unix epoch (UTC).
   * When sending to clients, always use DateTime.toTimestamp instead of raw Date objects.
   */
  static fromTimestamp(timestamp: number | null | undefined): Date | null {
    if (!timestamp) return null;
    return new Date(timestamp);
  }

  /**
   * Parse string format "YYYY-MM-DD HH:mm:ss" as UTC+7 timezone
   * String này đã là UTC+7, cần convert sang UTC để tạo Date object
   */
  static parseUTC7String(timeString: string): Date | null {
    try {
      const match = timeString.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
      if (!match) {
        // Fallback: parse như ISO string
        return new Date(timeString);
      }

      const [, year, month, day, hour, minute, second] = match.map(Number);
      
      // Tạo Date như UTC+7 (trừ 7 giờ để có UTC time)
      const utcDate = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
      
      return utcDate;
    } catch {
      return null;
    }
  }
}


