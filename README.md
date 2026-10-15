# business-days-kit

Working days between dates, adjusted for holidays.

```js
import {
  createBusinessDayCalculator,
  isBusinessDay,
  businessDaysBetween,
  addBusinessDays,
  nextBusinessDay,
  previousBusinessDay,
  saturateDate,
  WEEKEND
} from 'business-days-kit';

const calc = createBusinessDayCalculator({
  isHoliday: (date) => date.getMonth() === 11 && date.getDate() === 25
});

const start = new Date(2024, 0, 1);  // Mon
const end = new Date(2024, 0, 31);   // Wed

const days = calc.businessDaysBetween(start, end);
const shifted = calc.addBusinessDays(start, 10);
```

Standalone helpers (`isBusinessDay`, `nextBusinessDay`, `previousBusinessDay`, `businessDaysBetween`, `addBusinessDays`) default to a Saturday/Sunday weekend with no holidays; pass your own `isHoliday` and `isWeekendDay` predicates to override. `WEEKEND` is the default weekend predicate (exported so you can compose it). `saturateDate(date)` strips time-of-day to local midnight — useful when you need to feed clean dates to your own holiday predicate.

## Why this exists

SLAs, settlement deadlines, and project plans all need "N business days from now" or "how many working days between these two dates?" This library does exactly that and nothing else.

Holiday calendars are jurisdiction-specific and change yearly. Bundling a holiday table would either (a) be wrong for most users or (b) require shipping a data-maintenance pipeline — neither is appropriate for a focused utility. Instead you supply an `isHoliday(date)` predicate. The library handles weekends, day-stepping, and the counting arithmetic; you own the calendar knowledge.

## Edge you will hit

**`addBusinessDays` from a non-business day.** If the start date is itself a weekend or holiday, the library first advances to the next business day, then applies the offset. So `addBusinessDays(Saturday, 5)` lands on the Monday two weeks later, not the Friday before. This mirrors spreadsheet behaviour and is the one interpretation chosen here — if you need "skip to previous business day then subtract," call `previousBusinessDay` yourself first.

**`businessDaysBetween` is exclusive of both endpoints.** The count is the number of full business days strictly between the two dates; a Monday-to-Monday span is 5, not 6. If you need inclusive counting, add `isBusinessDay(start) ? 1 : 0` yourself.

**Date interpretation is local-time year/month/day only.** Time-of-day and timezone are stripped via `saturateDate` before any comparison, so two callers in different timezones get the same result for the same calendar date.

## Configuration

`createBusinessDayCalculator` accepts:

- `isHoliday(date)`: predicate, default none.
- `isWeekendDay(date)`: predicate, default `WEEKEND` (Saturday and Sunday).
- `minDate` / `maxDate`: ISO date strings bounding valid input/output. Used as a safety valve so a runaway calculation raises rather than loops forever.

## Running the tests

```bash
node --test
```
