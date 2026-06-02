// Timezone-aware operational hours calculator using native Intl APIs
// This prevents timezone drift and splits overnight shifts (e.g. 22:00 to 06:00) at midnight.

/**
 * Parses a "HH:MM" string and sets it on a given date in a specific timezone, returning the Date object.
 */
export function getTzTimeForDate(date: Date, timeStr: string, timezone: string = 'Asia/Kolkata'): Date {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  // Format the date to the target timezone's YYYY-MM-DD parts
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const formattedParts = formatter.formatToParts(date);
  const yearStr = formattedParts.find(p => p.type === 'year')?.value || '2026';
  const monthStr = formattedParts.find(p => p.type === 'month')?.value || '01';
  const dayStr = formattedParts.find(p => p.type === 'day')?.value || '01';

  // Construct an ISO-like string in the target timezone and parse it
  const isoStr = `${yearStr}-${monthStr}-${dayStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
  
  // Use Intl format to calculate offset
  const tzDate = new Date(new Date(isoStr).toLocaleString('en-US', { timeZone: timezone }));
  const localDate = new Date(isoStr);
  const diff = localDate.getTime() - tzDate.getTime();
  
  return new Date(localDate.getTime() + diff);
}

/**
 * Returns helper dates representing the start and end of calendar days in target timezone.
 */
export function getCalendarDaysRange(startDate: Date, endDate: Date, timezone: string = 'Asia/Kolkata'): Date[] {
  const days: Date[] = [];
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  // Scan day by day from start to end in 24h increments
  let current = new Date(startMs);
  
  while (current.getTime() <= endMs + 24 * 60 * 60 * 1000) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

/**
 * Calculates total warehouse working hours elapsed between two dates.
 * Falls back to 24-hour calculations if startTime and endTime are not defined or invalid.
 */
export function calculateWarehouseWorkingHours(
  startDate: Date,
  endDate: Date,
  startTimeStr?: string | null,
  endTimeStr?: string | null,
  timezone: string = 'Asia/Kolkata'
): number {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  if (startMs >= endMs) return 0;

  // Fallback to absolute calendar hour difference if start/end times are omitted
  const activeStart = startTimeStr?.trim();
  const activeEnd = endTimeStr?.trim();
  
  if (!activeStart || !activeEnd || activeStart === activeEnd) {
    return (endMs - startMs) / (1000 * 60 * 60);
  }

  const startParts = activeStart.split(':').map(Number);
  const endParts = activeEnd.split(':').map(Number);
  if (startParts.length < 2 || endParts.length < 2 || isNaN(startParts[0]) || isNaN(endParts[0])) {
    return (endMs - startMs) / (1000 * 60 * 60);
  }

  // Parse time intervals
  const isOvernight = (startParts[0] > endParts[0]) || (startParts[0] === endParts[0] && startParts[1] > endParts[1]);

  let totalWorkingMs = 0;

  // Retrieve list of unique calendar days involved
  const calendarDays = getCalendarDaysRange(startDate, endDate, timezone);

  for (const day of calendarDays) {
    // Segments of working hours on this day: [segmentStartStr, segmentEndStr]
    const segments: [string, string][] = [];

    if (!isOvernight) {
      // Single continuous segment on the same day
      segments.push([activeStart, activeEnd]);
    } else {
      // Overnight shift split at midnight:
      // Segment 1: from 00:00 to endTimeStr
      segments.push(['00:00', activeEnd]);
      // Segment 2: from startTimeStr to 24:00
      segments.push([activeStart, '23:59']);
    }

    for (const [segStartStr, segEndStr] of segments) {
      const segStart = getTzTimeForDate(day, segStartStr, timezone);
      let segEnd = getTzTimeForDate(day, segEndStr, timezone);
      
      if (segEndStr === '23:59') {
        // Adjust to actual end of day
        segEnd = new Date(segEnd.getTime() + 60 * 1000 - 1);
      }

      // Calculate intersection between [segStart, segEnd] and [startDate, endDate]
      const intersectStart = Math.max(segStart.getTime(), startMs);
      const intersectEnd = Math.min(segEnd.getTime(), endMs);

      if (intersectStart < intersectEnd) {
        totalWorkingMs += (intersectEnd - intersectStart);
      }
    }
  }

  return totalWorkingMs / (1000 * 60 * 60);
}
