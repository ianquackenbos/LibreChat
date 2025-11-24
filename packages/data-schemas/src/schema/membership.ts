import { Schema } from 'mongoose';
import type { IMembership } from '~/types';

const membershipSchema: Schema<IMembership> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to ensure one membership per user per org
membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
membershipSchema.index({ organizationId: 1, role: 1 });
membershipSchema.index({ createdAt: 1, updatedAt: 1 });

export default membershipSchema;

