import { Document, Types } from "mongoose";


export interface IAudit {
    operationId: string;
    productIds: Types.ObjectId[];
    variantCount: number;
    discountPercent: number;
    status: string;
    createdBy: Types.ObjectId;
    items: {
        variantId: Types.ObjectId;
        oldDiscountPercent: number;
        oldDiscountPrice: number;
    }[];
}

export interface IAuditDocument extends IAudit, Document {
     _id : Types.ObjectId,
    createdAt : Date,
    updatedAt : Date
}