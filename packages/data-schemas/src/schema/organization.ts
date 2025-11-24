import { Schema } from 'mongoose';
import type { IOrganization } from '~/types';

const organizationSchema: Schema<IOrganization> = new Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ssoConnectionId: {
      type: String,
      index: true,
      sparse: true,
    },
    verifiedDomains: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

organizationSchema.index({ createdAt: 1, updatedAt: 1 });
organizationSchema.index({ ownerId: 1, name: 1 });

export default organizationSchema;

