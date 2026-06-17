import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';

// Ofsted readiness — read-only RAG compliance summary (manager only).
export type OfstedStatus = 'green' | 'amber' | 'red';

export interface OfstedSection {
  key: string;
  label: string;
  status: OfstedStatus;
  detail: string;
}

export interface OfstedReadiness {
  sections: OfstedSection[];
}

export const ofstedKeys = {
  all: ['ofsted'] as const,
  summary: () => [...ofstedKeys.all, 'summary'] as const,
};

export function useOfsted() {
  return useQuery({
    queryKey: ofstedKeys.summary(),
    queryFn: () => api.get<OfstedReadiness>('/ofsted'),
  });
}
