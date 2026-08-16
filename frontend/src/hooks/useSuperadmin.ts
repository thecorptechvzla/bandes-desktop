'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

function hardDelete(path: string) {
  return api.delete(`/superadmin/${path}`).then((r) => r.data);
}

export function useHardDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hardDelete(`clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['bars'] });
      qc.invalidateQueries({ queryKey: ['processes'] });
      qc.invalidateQueries({ queryKey: ['packings'] });
      qc.invalidateQueries({ queryKey: ['material-exits'] });
      qc.invalidateQueries({ queryKey: ['lots'] });
    },
  });
}

export function useHardDeletePacking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hardDelete(`packings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packings'] });
      qc.invalidateQueries({ queryKey: ['bars'] });
    },
  });
}

export function useHardDeleteProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hardDelete(`processes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processes'] });
      qc.invalidateQueries({ queryKey: ['lots'] });
      qc.invalidateQueries({ queryKey: ['bars'] });
      qc.invalidateQueries({ queryKey: ['material-exits'] });
    },
  });
}

export function useHardDeleteMaterialExit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hardDelete(`material-exits/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material-exits'] });
      qc.invalidateQueries({ queryKey: ['bars'] });
      qc.invalidateQueries({ queryKey: ['lots'] });
    },
  });
}