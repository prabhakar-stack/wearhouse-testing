"use strict";
// Timezone-aware operational hours calculator using native Intl APIs
// This prevents timezone drift and splits overnight shifts (e.g. 22:00 to 06:00) at midnight.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTzTimeForDate = getTzTimeForDate;
exports.getCalendarDaysRange = getCalendarDaysRange;
exports.calculateWarehouseWorkingHours = calculateWarehouseWorkingHours;
/**
 * Parses a "HH:MM" string and sets it on a given date in a specific timezone, returning the Date object.
 */
function getTzTimeForDate(date, timeStr, timezone) {
    var _a, _b, _c;
    if (timezone === void 0) { timezone = 'Asia/Kolkata'; }
    var parts = timeStr.split(':');
    var hours = parseInt(parts[0], 10);
    var minutes = parseInt(parts[1], 10);
    // Format the date to the target timezone's YYYY-MM-DD parts
    var formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    var formattedParts = formatter.formatToParts(date);
    var yearStr = ((_a = formattedParts.find(function (p) { return p.type === 'year'; })) === null || _a === void 0 ? void 0 : _a.value) || '2026';
    var monthStr = ((_b = formattedParts.find(function (p) { return p.type === 'month'; })) === null || _b === void 0 ? void 0 : _b.value) || '01';
    var dayStr = ((_c = formattedParts.find(function (p) { return p.type === 'day'; })) === null || _c === void 0 ? void 0 : _c.value) || '01';
    // Construct an ISO-like string in the target timezone and parse it
    var isoStr = "".concat(yearStr, "-").concat(monthStr, "-").concat(dayStr, "T").concat(hours.toString().padStart(2, '0'), ":").concat(minutes.toString().padStart(2, '0'), ":00");
    // Use Intl format to calculate offset
    var tzDate = new Date(new Date(isoStr).toLocaleString('en-US', { timeZone: timezone }));
    var localDate = new Date(isoStr);
    var diff = localDate.getTime() - tzDate.getTime();
    return new Date(localDate.getTime() + diff);
}
/**
 * Returns helper dates representing the start and end of calendar days in target timezone.
 */
function getCalendarDaysRange(startDate, endDate, timezone) {
    if (timezone === void 0) { timezone = 'Asia/Kolkata'; }
    var days = [];
    var startMs = startDate.getTime();
    var endMs = endDate.getTime();
    // Scan day by day from start to end in 24h increments
    var current = new Date(startMs);
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
function calculateWarehouseWorkingHours(startDate, endDate, startTimeStr, endTimeStr, timezone) {
    if (timezone === void 0) { timezone = 'Asia/Kolkata'; }
    var startMs = startDate.getTime();
    var endMs = endDate.getTime();
    if (startMs >= endMs)
        return 0;
    // Fallback to absolute calendar hour difference if start/end times are omitted
    var activeStart = startTimeStr === null || startTimeStr === void 0 ? void 0 : startTimeStr.trim();
    var activeEnd = endTimeStr === null || endTimeStr === void 0 ? void 0 : endTimeStr.trim();
    if (!activeStart || !activeEnd || activeStart === activeEnd) {
        return (endMs - startMs) / (1000 * 60 * 60);
    }
    var startParts = activeStart.split(':').map(Number);
    var endParts = activeEnd.split(':').map(Number);
    if (startParts.length < 2 || endParts.length < 2 || isNaN(startParts[0]) || isNaN(endParts[0])) {
        return (endMs - startMs) / (1000 * 60 * 60);
    }
    // Parse time intervals
    var isOvernight = (startParts[0] > endParts[0]) || (startParts[0] === endParts[0] && startParts[1] > endParts[1]);
    var totalWorkingMs = 0;
    // Retrieve list of unique calendar days involved
    var calendarDays = getCalendarDaysRange(startDate, endDate, timezone);
    for (var _i = 0, calendarDays_1 = calendarDays; _i < calendarDays_1.length; _i++) {
        var day = calendarDays_1[_i];
        // Segments of working hours on this day: [segmentStartStr, segmentEndStr]
        var segments = [];
        if (!isOvernight) {
            // Single continuous segment on the same day
            segments.push([activeStart, activeEnd]);
        }
        else {
            // Overnight shift split at midnight:
            // Segment 1: from 00:00 to endTimeStr
            segments.push(['00:00', activeEnd]);
            // Segment 2: from startTimeStr to 24:00
            segments.push([activeStart, '23:59']);
        }
        for (var _a = 0, segments_1 = segments; _a < segments_1.length; _a++) {
            var _b = segments_1[_a], segStartStr = _b[0], segEndStr = _b[1];
            var segStart = getTzTimeForDate(day, segStartStr, timezone);
            var segEnd = getTzTimeForDate(day, segEndStr, timezone);
            if (segEndStr === '23:59') {
                // Adjust to actual end of day
                segEnd = new Date(segEnd.getTime() + 60 * 1000 - 1);
            }
            // Calculate intersection between [segStart, segEnd] and [startDate, endDate]
            var intersectStart = Math.max(segStart.getTime(), startMs);
            var intersectEnd = Math.min(segEnd.getTime(), endMs);
            if (intersectStart < intersectEnd) {
                totalWorkingMs += (intersectEnd - intersectStart);
            }
        }
    }
    return totalWorkingMs / (1000 * 60 * 60);
}
