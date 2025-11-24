import type * as t from '~/types';
import membershipSchema from '~/schema/membership';

/**
 * Creates or returns the Membership model using the provided mongoose instance and schema
 */
export function createMembershipModel(mongoose: typeof import('mongoose')) {
  return (
    mongoose.models.Membership ||
    mongoose.model<t.IMembership>('Membership', membershipSchema)
  );
}

