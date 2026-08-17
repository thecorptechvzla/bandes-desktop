'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { OperatorMetricsResponse } from '@/types/api';

export function useOperatorMetrics() {
  return useQuery<OperatorMetricsResponse>({
    queryKey: ['dashboard', 'operator-metrics'],
    queryFn: () => api.get('/dashboard/operator-metrics').then((r) => r.data),
    refetchInterval: (query) => (query.state.data ? 30_000 : false),
    retry: 1,
  });
}
