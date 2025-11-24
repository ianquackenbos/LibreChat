import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { QueryObserverResult } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';

export interface Organization {
  id: string;
  name: string;
  ssoConnectionId?: string;
  verifiedDomains?: string[];
  createdAt: string;
  updatedAt: string;
}

export const useGetCurrentOrganizationQuery = (
  options?: UseQueryOptions<Organization | null>,
): QueryObserverResult<Organization | null> => {
  return useQuery(
    [QueryKeys.currentOrganization],
    () => dataService.getCurrentOrganization(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      ...options,
    },
  );
};

