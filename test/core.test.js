import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBusinessDayCalculator,
  isBusinessDay,
  nextBusinessDay,
  previousBusinessDay,
  businessDaysBetween,
  addBusinessDays,
  saturateDate,
  WEEKEND
} from '../src/index.js';

// Helper: build a holiday predicate from a set of ISO date strings.
function holidaySet(dates) {
  const set = new Set(dates);
  return (date) => set.has(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
}

// 2024 calendar reference (Jan 1 is a Monday)
const MON = new Date(2024, 0, 1);   // Monday
const TUE = new Date(2024, 0, 2);
const WED = new Date(2024, 0, 3);
const THU = new Date(2024, 0, 4);
const FRI = new Date(2024, 0, 5);
const SAT = new Date(2024, 0, 6);
const SUN = new Date(2024, 0, 7);

const XMAS_2024 = new Date(2024, 11, 25);   // Wednesday
const BOXING_2024 = new Date(2024, 11, 26); // Thursday
const NEW_YEARS_2025 = new Date(2025, 0, 1);// Wednesday

function getDay(date) {
  return date.getDay();
}

test('isBusinessDay identifies weekdays as business days', () => {
  assert.equal(isBusinessDay(MON), true);
  assert.equal(isBusinessDay(FRI), true);
});

test('isBusinessDay rejects weekends', () => {
  assert.equal(isBusinessDay(SAT), false);
  assert.equal(isBusinessDay(SUN), false);
});

test('isBusinessDay honours a holiday predicate', () => {
  const isHoliday = holidaySet(['2024-01-01']);
  assert.equal(isBusinessDay(MON, isHoliday), false);
  assert.equal(isBusinessDay(TUE, isHoliday), true);
});

test('isBusinessDay ignores time-of-day on the input', () => {
  const morning = new Date(2024, 0, 1, 8, 30, 0);
  const evening = new Date(2024, 0, 1, 23, 59, 59);
  assert.equal(isBusinessDay(morning), true);
  assert.equal(isBusinessDay(evening), true);
});

test('nextBusinessDay skips a single weekend day', () => {
  const result = nextBusinessDay(FRI);
  assert.equal(getDay(result), 1); // Monday
});

test('nextBusinessDay skips a holiday', () => {
  const isHoliday = holidaySet(['2024-01-01']);
  const result = nextBusinessDay(MON, isHoliday);
  assert.deepEqual(result, TUE);
});

test('nextBusinessDay skips a weekend plus a holiday', () => {
  const isHoliday = holidaySet(['2024-01-08']); // next Monday
  const result = nextBusinessDay(FRI, isHoliday);
  assert.deepEqual(result, new Date(2024, 0, 9)); // Tuesday
});

test('previousBusinessDay from Monday lands on Friday', () => {
  const result = previousBusinessDay(MON);
  assert.deepEqual(result, new Date(2023, 11, 29)); // Friday Dec 29 2023
});

test('businessDaysBetween returns 0 for same day', () => {
  assert.equal(businessDaysBetween(MON, MON), 0);
});

test('businessDaysBetween counts full business days forward', () => {
  assert.equal(businessDaysBetween(MON, FRI), 4);
});

test('businessDaysBetween counts a week as 5', () => {
  const nextMon = new Date(2024, 0, 8);
  assert.equal(businessDaysBetween(MON, nextMon), 5);
});

test('businessDaysBetween is negative when end precedes start', () => {
  assert.equal(businessDaysBetween(FRI, MON), -4);
});

test('businessDaysBetween excludes holidays', () => {
  const isHoliday = holidaySet(['2024-01-01', '2024-01-02']);
  assert.equal(businessDaysBetween(MON, FRI, isHoliday), 3);
});

test('businessDaysBetween excludes holidays on endpoints themselves', () => {
  const isHoliday = holidaySet(['2024-01-01']);
  // MON is a holiday; TUE through FRI are business days => 4
  assert.equal(businessDaysBetween(MON, FRI, isHoliday), 4);
});

test('businessDaysBetween crosses a weekend without counting it', () => {
  const nextWed = new Date(2024, 0, 10);
  // Jan 1 (Mon) to Jan 10 (Wed): Tue-Fri (4) + Mon, Tue, Wed (3) = 7
  assert.equal(businessDaysBetween(MON, nextWed), 7);
});

test('addBusinessDays with 0 returns the same business day', () => {
  assert.deepEqual(addBusinessDays(MON, 0), MON);
});

test('addBusinessDays advances by positive count', () => {
  assert.deepEqual(addBusinessDays(MON, 5), new Date(2024, 0, 8)); // next Monday
});

test('addBusinessDays retreats by negative count', () => {
  const result = addBusinessDays(MON, -1);
  assert.deepEqual(result, new Date(2023, 11, 29));
});

test('addBusinessDays from a weekend advances to the next business day first', () => {
  // From Saturday with n=5: step to Monday Jan 8, then count 5 more
  // business days, landing on Monday Jan 15.
  const result = addBusinessDays(SAT, 5);
  assert.deepEqual(result, new Date(2024, 0, 15));
});

test('addBusinessDays with a holiday mid-path skips it', () => {
  const isHoliday = holidaySet(['2024-01-03']);
  // From Mon with +3: Tue, Wed is holiday -> skip, Thu, Fri => land on Fri
  assert.deepEqual(addBusinessDays(MON, 3, isHoliday), FRI);
});

test('createBusinessDayCalculator wires up configuration', () => {
  const calc = createBusinessDayCalculator({
    isHoliday: holidaySet(['2024-01-01'])
  });
  assert.equal(calc.isBusinessDay(MON), false);
  assert.equal(calc.isBusinessDay(TUE), true);
});

test('createBusinessDayCalculator exposes bound methods consistently', () => {
  const calc = createBusinessDayCalculator();
  assert.deepEqual(calc.nextBusinessDay(FRI), new Date(2024, 0, 8));
  assert.equal(calc.businessDaysBetween(MON, FRI), 4);
});

test('saturateDate strips the time component', () => {
  const withTime = new Date(2024, 0, 5, 15, 45, 30, 500);
  const saturated = saturateDate(withTime);
  assert.equal(saturated.getHours(), 0);
  assert.equal(saturated.getMinutes(), 0);
  assert.equal(saturated.getSeconds(), 0);
  assert.equal(saturated.getMilliseconds(), 0);
});

test('WEEKEND predicate returns true for Saturday and Sunday only', () => {
  assert.equal(WEEKEND(SAT), true);
  assert.equal(WEEKEND(SUN), true);
  assert.equal(WEEKEND(MON), false);
  assert.equal(WEEKEND(FRI), false);
});

test('createBusinessDayCalculator uses a custom weekend predicate', () => {
  const friSatWeekend = (date) => {
    const d = date.getDay();
    return d === 5 || d === 6;
  };
  const calc = createBusinessDayCalculator({ isWeekendDay: friSatWeekend });
  // With Fri-Sat weekend: Sun-Thu are business days
  assert.equal(calc.isBusinessDay(SUN), true);
  assert.equal(calc.isBusinessDay(THU), true);
  assert.equal(calc.isBusinessDay(FRI), false);
  assert.equal(calc.isBusinessDay(SAT), false);
});

test('addBusinessDays negative from a weekend steps forward first then back', () => {
  // From Saturday with n=-1: per README, the library first advances to
  // the next business day (Monday Jan 8), then applies the negative
  // offset, landing on Friday Jan 5.
  const result = addBusinessDays(SAT, -1);
  assert.deepEqual(result, new Date(2024, 0, 5));
});
