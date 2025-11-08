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
}


