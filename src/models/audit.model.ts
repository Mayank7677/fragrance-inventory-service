import { Schema, model } from "mongoose";
import { IAuditDocument } from "../schema/audit.schema";

const AuditSchema = new Schema<IAuditDocument>(
  {
    operationId: { type: String, required: true, unique: true, index: true },
    productIds: [{ type: Schema.Types.ObjectId }],
    variantCount: { type: Number },
    discountPercent: { type: Number },
    status: {
      type: String,
      enum: ["pending", "committed", "rolledback"],
      default: "pending",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    items: [
      {
        variantId: { type: Schema.Types.ObjectId, required: true },
        oldDiscountPercent: { type: Number, required: true },
        oldDiscountPrice: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

export default model<IAuditDocument>("Audit", AuditSchema);
