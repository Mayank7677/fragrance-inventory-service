import { Document, Types } from "mongoose";

export interface IVariant {
  productId: Types.ObjectId;
  size: string; // e.g., "50ml", "100ml"
  sku: string; // Unique per variant
  price: number;
  stock: number;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  discountPrice?: number;
  discountPercent?: number
}

export interface IVariantDocument extends IVariant, Document {
    _id : Types.ObjectId,
    createdAt : Date,
    updatedAt : Date
}
