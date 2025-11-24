import type { Document, Types } from 'mongoose';

export type Membership = {
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  role: 'owner' | 'admin' | 'member';
  createdAt?: Date;
  updatedAt?: Date;
};

export type IMembership = Membership &
  Document & {
    _id: Types.ObjectId;
  };

