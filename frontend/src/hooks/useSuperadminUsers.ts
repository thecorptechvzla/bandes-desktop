'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User, CreateUserRequest } from '@/types/api';

export function useSuperadminUsers() {
  return useQuery<User[]>({
    queryKey: ['superadmin', 'users'],
    queryFn: () => api.get('/superadmin/users').then((r) => r.data),
  });
}

export function useCreateSuperadminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserRequest) =>
      api.post('/superadmin/users', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
    },
  });
}

export function useDeleteSuperadminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/superadmin/users/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
    },
  });
}