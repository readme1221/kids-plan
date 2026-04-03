/**
 * 时间工具函数
 * 所有日期操作统一使用 UTC 避免时区问题
 */

/** 获取日期所在周的周一 */
export function getMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // 周日算上一周
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/** 获取日期所在周的周日 */
export function getSunday(date: Date): Date {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return sunday;
}

/** 获取日期的星期几 (0=周日, 1=周一, ..., 6=周六) */
export function getDayOfWeek(date: Date): number {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).getUTCDay();
}

/** 日期格式化为 YYYY-MM-DD */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 解析 YYYY-MM-DD 为 UTC Date */
export function parseDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 两个日期间隔天数 */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86400000;
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((toUtc - fromUtc) / msPerDay);
}

/** 是否同一天 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 今天的 UTC 日期（去掉时间部分） */
export function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** 生成一周的日期数组（周一到周日） */
export function getWeekDates(monday: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    dates.push(d);
  }
  return dates;
}

/** 星期几的中文名 */
const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "";
}
