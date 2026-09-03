import { useQuery } from '@tanstack/react-query';
import { api, type MeResponse } from './client';
import type { StageDef } from '../data/stages';
import { STAGES as FALLBACK } from '../data/stages';

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api.get<MeResponse>('/api/me'),
    retry: false,
    staleTime: 30_000,
  });
}

export function useStages() {
  return useQuery<StageDef[]>({
    queryKey: ['stages'],
    queryFn: () => api.get<StageDef[]>('/api/stages'),
    staleTime: 60_000,
    // fallback пока бек не ответил
    placeholderData: FALLBACK,
  });
}
