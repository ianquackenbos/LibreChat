import type { Document, Types } from 'mongoose';

export type OrganizationInvite = {
  email: string;
  organizationId: Types.ObjectId;
  inviterId: Types.ObjectId;
  role: 'admin' | 'member';
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type IOrganizationInvite = OrganizationInvite &
  Document & {
    _id: Types.ObjectId;
  };

