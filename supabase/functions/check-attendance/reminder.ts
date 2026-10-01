/** Aturan jadwal reminder. Semua nilai waktu adalah waktu lokal pengguna. */
export function isReminderTimeDue(
  reminderTimes: string[],
  intervalSeconds: number,
  now: Date,
  timezone: string,
): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const nowSeconds = valueFor('hour') * 3600 + valueFor('minute') * 60 + valueFor('second');

  return reminderTimes.some((time) => {
    const [hour, minute, second = '0'] = time.split(':').map(Number);
    const scheduledSeconds = hour * 3600 + minute * 60 + second;
    return nowSeconds >= scheduledSeconds && nowSeconds - scheduledSeconds < intervalSeconds;
  });
}
