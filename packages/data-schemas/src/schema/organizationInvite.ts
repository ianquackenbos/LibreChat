import { Schema } from 'mongoose';
import type { IOrganizationInvite } from '~/types';

const organizationInviteSchema: Schema<IOrganizationInvite> = new Schema(
  {
    email: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    inviterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'member'],
      default: 'member',
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
    acceptedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

organizationInviteSchema.index({ email: 1, organizationId: 1 });
organizationInviteSchema.index({ organizationId: 1, acceptedAt: 1 });
organizationInviteSchema.index({ createdAt: 1, updatedAt: 1 });

export default organizationInviteSchema;

