import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';

// Funded hours per child for a given week (manager only). The API requires a
// weekStart (the Monday, YYYY-MM-DD) query param.
export interface FundedHoursChild {
  childId: number;
  name: string;
  room: string;
  days: Record<string, number>;
  total: number;
}

export interface FundedHoursReport {
  weekStart: string;
  weekEnd: string;
  children: FundedHoursChild[];
  totalFundedHours: number;
}

export const fundedHoursKeys = {
  all: ['funded-hours'] as const,
  week: (weekStart: string) => [...fundedHoursKeys.all, weekStart] as const,
};

export function useFundedHours(weekStart: string) {
  return useQuery({
    queryKey: fundedHoursKeys.week(weekStart),
    queryFn: () => api.get<FundedHoursReport>(`/funded-hours?weekStart=${weekStart}`),
  });
}
