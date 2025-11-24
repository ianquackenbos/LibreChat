import type * as t from '~/types';
import organizationInviteSchema from '~/schema/organizationInvite';

/**
 * Creates or returns the OrganizationInvite model using the provided mongoose instance and schema
 */
export function createOrganizationInviteModel(mongoose: typeof import('mongoose')) {
  return (
    mongoose.models.OrganizationInvite ||
    mongoose.model<t.IOrganizationInvite>('OrganizationInvite', organizationInviteSchema)
  );
}

