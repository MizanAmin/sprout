export type AgeBand = 'under2' | '2yo' | '3to4';

// Subset of the nurseries row needed for rate lookups.
export interface NurseryRates {
  fee_rate: number;
  fee_rate_under2: number;
  fee_rate_2yo: number;
  fee_rate_3to4: number;
  funding_rate_under2: number;
  funding_rate_2yo: number;
  funding_rate_3to4: number;
}

export function ageBandForDob(dob: string | null, asOf?: Date): AgeBand {
  if (!dob) return '3to4';
  const birth = new Date(dob);
  const ref = asOf ?? new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  if (age < 2) return 'under2';
  if (age === 2) return '2yo';
  return '3to4';
}

export function ratesForBand(nursery: NurseryRates, band: AgeBand) {
  const map = {
    under2: nursery.fee_rate_under2,
    '2yo': nursery.fee_rate_2yo,
    '3to4': nursery.fee_rate_3to4,
  };
  const fundingMap = {
    under2: nursery.funding_rate_under2,
    '2yo': nursery.funding_rate_2yo,
    '3to4': nursery.funding_rate_3to4,
  };
  return { feeRate: map[band] ?? nursery.fee_rate, fundingRate: fundingMap[band] ?? 0 };
}
