import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MutationKeys, QueryKeys, dataService } from 'librechat-data-provider';
import type { UseMutationResult } from '@tanstack/react-query';

export interface CreateOrganizationPayload {
  name: string;
  members: Array<{
    email: string;
    role: 'user' | 'administrator';
  }>;
}

export interface Organization {
  id: string;
  name: string;
  ssoConnectionId?: string;
  verifiedDomains?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationResponse {
  organization: Organization;
}

export interface UpdateOrganizationPayload {
  id: string;
  name?: string;
  ssoConnectionId?: string | null;
  verifiedDomains?: string[];
}

export const useCreateOrganizationMutation = (
  options?: {
    onSuccess?: (data: CreateOrganizationResponse) => void;
    onError?: (error: Error) => void;
  },
): UseMutationResult<CreateOrganizationResponse, Error, CreateOrganizationPayload> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [MutationKeys.createOrganization],
    mutationFn: (payload: CreateOrganizationPayload) => dataService.createOrganization(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.currentOrganization] });
      options?.onSuccess?.(data, variables, context);
    },
    onError: options?.onError,
  });
};

export const useUpdateOrganizationMutation = (
  options?: {
    onSuccess?: (data: CreateOrganizationResponse) => void;
    onError?: (error: Error) => void;
  },
): UseMutationResult<CreateOrganizationResponse, Error, UpdateOrganizationPayload> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [MutationKeys.createOrganization],
    mutationFn: (payload: UpdateOrganizationPayload) => dataService.updateOrganization(payload),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.currentOrganization] });
      options?.onSuccess?.(data, variables, context);
    },
    onError: options?.onError,
  });
};

