'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Role, CreateRoleRequest, UpdateRoleRequest } from '@/types/api';

export function useSuperadminRoles() {
  return useQuery<Role[]>({
    queryKey: ['superadmin', 'roles'],
    queryFn: () => api.get('/superadmin/roles').then((r) => r.data),
  });
}

export function useCreateSuperadminRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRoleRequest) =>
      api.post('/superadmin/roles', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
    },
  });
}

export function useUpdateSuperadminRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoleRequest }) =>
      api.patch(`/superadmin/roles/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
    },
  });
}

export function useDeleteSuperadminRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/superadmin/roles/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
    },
  });
}