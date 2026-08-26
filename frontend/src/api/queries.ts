import { useQuery } from '@tanstack/react-query';
import { api, type MeResponse } from './client';

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api.get<MeResponse>('/api/me'),
    retry: false,
    staleTime: 30_000,
  });
}
