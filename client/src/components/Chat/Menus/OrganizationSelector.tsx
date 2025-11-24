import React, { useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useLocalize } from '~/hooks';
import OrganizationModal from './OrganizationModal';
import { cn } from '~/utils';
import { useGetCurrentOrganizationQuery } from '~/data-provider/Organizations';

export default function OrganizationSelector() {
  const localize = useLocalize();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: organization } = useGetCurrentOrganizationQuery();

  const handleClick = () => {
    setIsModalOpen(true);
  };

  const handleOrganizationCreated = () => {
    setIsModalOpen(false);
    // Query will automatically refetch
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          'my-1 flex h-10 items-center justify-center gap-2 rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary hover:bg-surface-tertiary',
          'max-w-[200px]',
        )}
        aria-label={localize('com_ui_organization') || 'Organization'}
      >
        {organization?.name ? (
          <>
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{organization.name}</span>
          </>
        ) : (
          <>
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <Plus className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{localize('com_ui_new_organization') || 'New Organization'}</span>
          </>
        )}
      </button>
      <OrganizationModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onOrganizationCreated={handleOrganizationCreated}
        currentOrganization={organization?.id || null}
      />
    </>
  );
}
