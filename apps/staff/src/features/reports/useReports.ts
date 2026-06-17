import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';

// Read-only report aggregates (manager only).
export interface ReportsOverview {
  attendanceTodayPct: number;
  activeChildren: number;
  activities30d: number;
  avgEyfsScore: number;
}

export interface ChildrenByRoom {
  room: string;
  count: number;
}

export interface AttendanceBreakdown {
  present: number;
  absent: number;
  late: number;
  notMarked: number;
}

export interface EyfsByArea {
  area: string;
  avgScore: number;
  count: number;
}

export interface FinanceSummary {
  collected: number;
  pending: number;
  overdue: number;
  collectionRate: number;
}

export const reportsKeys = {
  all: ['reports'] as const,
  overview: () => [...reportsKeys.all, 'overview'] as const,
  childrenByRoom: () => [...reportsKeys.all, 'children-by-room'] as const,
  attendanceBreakdown: (date?: string) =>
    [...reportsKeys.all, 'attendance-breakdown', date ?? 'today'] as const,
  eyfsByArea: () => [...reportsKeys.all, 'eyfs-by-area'] as const,
  financeSummary: () => ['finance', 'summary'] as const,
};

export function useReportsOverview() {
  return useQuery({
    queryKey: reportsKeys.overview(),
    queryFn: () => api.get<ReportsOverview>('/reports/overview'),
  });
}

export function useChildrenByRoom() {
  return useQuery({
    queryKey: reportsKeys.childrenByRoom(),
    queryFn: () => api.get<ChildrenByRoom[]>('/reports/children-by-room'),
  });
}

export function useAttendanceBreakdown(date?: string) {
  return useQuery({
    queryKey: reportsKeys.attendanceBreakdown(date),
    queryFn: () =>
      api.get<AttendanceBreakdown>(
        `/reports/attendance-breakdown${date ? `?date=${date}` : ''}`,
      ),
  });
}

export function useEyfsByArea() {
  return useQuery({
    queryKey: reportsKeys.eyfsByArea(),
    queryFn: () => api.get<EyfsByArea[]>('/reports/eyfs-by-area'),
  });
}

export function useFinanceSummary() {
  return useQuery({
    queryKey: reportsKeys.financeSummary(),
    queryFn: () => api.get<FinanceSummary>('/finance/summary'),
  });
}
