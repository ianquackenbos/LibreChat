import type { Document, Types } from 'mongoose';

export type Organization = {
  name: string;
  slug?: string;
  ownerId: Types.ObjectId;
  ssoConnectionId?: string;
  verifiedDomains?: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type IOrganization = Organization &
  Document & {
    _id: Types.ObjectId;
  };

