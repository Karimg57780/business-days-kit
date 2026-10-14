/**
 * Core business-day logic.
 *
 * Design note: Holiday support is caller-supplied via a function rather
 * than a baked-in list. Real-world holiday schedules are jurisdiction-specific
 * and change year to year; embedding a fixed table would be misleading and
 * would go stale. Instead the caller passes an `isHoliday(date)` predicate.
 * This keeps the library honest about what it can and cannot know.
 *
 * All `Date` parameters are interpreted by their local year/month/day fields
 * only. Time-of-day and timezone are ignored so that two callers in different
 * timezones get the same answer for the same calendar date.
 */

/**
 * Inclusive lower bound for ISO date saturation. Y2K38-safe and well before
 * any realistic business-day calculation.
 */
const MIN_ISO_DATE = '0000-01-01';

/**
 * Default weekend predicate: Saturday and Sunday (ISO weekday 6 and 0).
 */
export function WEEKEND(date) {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

/**
 * Normalize a Date to midnight local time. We compare dates by whole calendar
 * days, so any time component would create false mismatches.
 */
export function saturateDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Return YYYY-MM-DD. Only used for the safety valve limits.
 */
function toISODate(date) {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWeekend(date, isWeekendDay) {
  if (isWeekendDay === WEEKEND) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
  return isWeekendDay(date);
}

/**
 * Create a configured business-day calculator.
 *
 * @param {object} [options]
 * @param {function(Date): boolean} [options.isHoliday] - Predicate returning
 *   true for a holiday. Dates passed are at local midnight. Default: none.
 * @param {function(Date): boolean} [options.isWeekendDay] - Predicate for
 *   weekend days. Default: Saturday and Sunday.
 * @param {string} [options.minDate] - ISO date string for the inclusive lower
 *   bound. Calculations that step past this raise an Error instead of looping.
 *   Default: '0000-01-01'.
 * @param {string} [options.maxDate] - ISO date string for the inclusive upper
 *   bound. Default: '9999-12-31'.
 */
export function createBusinessDayCalculator(options = {}) {
  const isHoliday = options.isHoliday || (() => false);
  const isWeekendDay = options.isWeekendDay || WEEKEND;
  const minDate = options.minDate || MIN_ISO_DATE;
  const maxDate = options.maxDate || '9999-12-31';

  const minParts = minDate.split('-').map(Number);
  const maxParts = maxDate.split('-').map(Number);
  const minDateObj = new Date(minParts[0], minParts[1] - 1, minParts[2]);
  const maxDateObj = new Date(maxParts[0], maxParts[1] - 1, maxParts[2]);

  function isHolidayLocal(date) {
    return isHoliday(date);
  }

  function isNonBusiness(date) {
    return isWeekend(date, isWeekendDay) || isHolidayLocal(date);
  }

  function validateInput(date) {
    const d = saturateDate(date);
    if (d.getTime() < minDateObj.getTime()) {
      throw new Error(`Date ${toISODate(d)} is before minDate ${minDate}`);
    }
    if (d.getTime() > maxDateObj.getTime()) {
      throw new Error(`Date ${toISODate(d)} is after maxDate ${maxDate}`);
    }
    return d;
  }

  return {
    isHoliday: isHolidayLocal,
    isWeekendDay: (d) => isWeekend(saturateDate(d), isWeekendDay),
    isNonBusiness,

    isBusinessDay(date) {
      return isBusinessDay(validateInput(date), isHolidayLocal, isWeekendDay);
    },

    nextBusinessDay(date) {
      const d = validateInput(date);
      return nextBusinessDay(d, isHolidayLocal, isWeekendDay, maxDateObj);
    },

    previousBusinessDay(date) {
      const d = validateInput(date);
      return previousBusinessDay(d, isHolidayLocal, isWeekendDay, minDateObj);
    },

    businessDaysBetween(start, end) {
      const startD = validateInput(start);
      const endD = validateInput(end);
      return businessDaysBetween(startD, endD, isHolidayLocal, isWeekendDay);
    },

    addBusinessDays(date, n) {
      const d = validateInput(date);
      return addBusinessDays(d, n, isHolidayLocal, isWeekendDay, minDateObj, maxDateObj);
    }
  };
}

/**
 * Standalone helpers (use default weekend and no holidays). For richer
 * configuration, use {@link createBusinessDayCalculator}.
 */

export function isBusinessDay(date, isHoliday = () => false, isWeekendDay = WEEKEND) {
  const d = saturateDate(date);
  if (toISODate(d) < MIN_ISO_DATE) {
    throw new Error(`Date ${toISODate(d)} is before minimum ${MIN_ISO_DATE}`);
  }
  return !isWeekend(d, isWeekendDay) && !isHoliday(d);
}

export function nextBusinessDay(date, isHoliday = () => false, isWeekendDay = WEEKEND) {
  let d = saturateDate(date);
  do {
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  } while (isWeekend(d, isWeekendDay) || isHoliday(d));
  return d;
}

export function previousBusinessDay(date, isHoliday = () => false, isWeekendDay = WEEKEND) {
  let d = saturateDate(date);
  do {
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  } while (isWeekend(d, isWeekendDay) || isHoliday(d));
  return d;
}

export function businessDaysBetween(start, end, isHoliday = () => false, isWeekendDay = WEEKEND) {
  const startDate = saturateDate(start);
  const endDate = saturateDate(end);
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  if (startTime === endTime) {
    return 0;
  }

  let count = 0;
  if (startTime < endTime) {
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1);
    while (cursor.getTime() <= endTime) {
      if (!isWeekend(cursor, isWeekendDay) && !isHoliday(cursor)) {
        count++;
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
  } else {
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() - 1);
    while (cursor.getTime() >= endTime) {
      if (!isWeekend(cursor, isWeekendDay) && !isHoliday(cursor)) {
        count--;
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
    }
  }
  return count;
}

export function addBusinessDays(date, n, isHoliday = () => false, isWeekendDay = WEEKEND, minDateObj = null, maxDateObj = null) {
  const d = saturateDate(date);

  // From a weekend/holiday, move to the next business day before accumulating.
  // This mirrors how most spreadsheet and calendar tools behave: "add 5
  // business days" starting from a Saturday advances to Monday, then counts
  // five more.
  if (isWeekend(d, isWeekendDay) || isHoliday(d)) {
    const stepped = nextBusinessDay(d, isHoliday, isWeekendDay);
    if (n > 0) {
      let cursor = stepped;
      let remaining = n;
      while (remaining > 0) {
        if (maxDateObj && cursor.getTime() > maxDateObj.getTime()) {
          throw new Error('addBusinessDays overflow past maxDate');
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        if (!isWeekend(cursor, isWeekendDay) && !isHoliday(cursor)) {
          remaining--;
        }
      }
      return cursor;
    }
    if (n < 0) {
      let cursor = stepped;
      let remaining = -n;
      while (remaining > 0) {
        if (minDateObj && cursor.getTime() < minDateObj.getTime()) {
          throw new Error('addBusinessDays underflow past minDate');
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
        if (!isWeekend(cursor, isWeekendDay) && !isHoliday(cursor)) {
          remaining--;
        }
      }
      return cursor;
    }
    return stepped;
  }

  if (n > 0) {
    let remaining = n;
    let cursor = d;
    while (remaining > 0) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      if (maxDateObj && cursor.getTime() > maxDateObj.getTime()) {
        throw new Error('addBusinessDays overflow past maxDate');
      }
      if (!isWeekend(cursor, isWeekendDay) && !isHoliday(cursor)) {
        remaining--;
      }
    }
    return cursor;
  }

  if (n < 0) {
    let remaining = -n;
    let cursor = d;
    while (remaining > 0) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
      if (minDateObj && cursor.getTime() < minDateObj.getTime()) {
        throw new Error('addBusinessDays underflow past minDate');
      }
      if (!isWeekend(cursor, isWeekendDay) && !isHoliday(cursor)) {
        remaining--;
      }
    }
    return cursor;
  }

  return d;
}
