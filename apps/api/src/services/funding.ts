import { expandPatternsForRange, type ChildSessionPattern } from './sessionPatterns';
import { ageBandForDob, ratesForBand, type NurseryRates } from './ageBands';

// LA funding calculation helpers — expected funded hours/amount for a child over
// a funding period, derived from their child_sessions and the nursery's age-band
// funding rates. Reuses the session-pattern + age-band primitives.

export function expectedFundedHours(
  sessions: ChildSessionPattern[],
  periodStart: string,
  periodEnd: string,
): number {
  return expandPatternsForRange(sessions, periodStart, periodEnd).fundedHours;
}

export function expectedFunding(opts: {
  sessions: ChildSessionPattern[];
  periodStart: string;
  periodEnd: string;
  nursery: NurseryRates;
  dob: string | null;
  asOf?: Date;
}): { fundedHours: number; fundingRate: number; amount: number } {
  const fundedHours = expectedFundedHours(opts.sessions, opts.periodStart, opts.periodEnd);
  const { fundingRate } = ratesForBand(opts.nursery, ageBandForDob(opts.dob, opts.asOf));
  return { fundedHours, fundingRate, amount: Number((fundedHours * fundingRate).toFixed(2)) };
}
