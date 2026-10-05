/** Calendar date key (YYYY-MM-DD) for an ISO timestamp in the requested timezone. */
export function dateKeyInTz(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const value = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
