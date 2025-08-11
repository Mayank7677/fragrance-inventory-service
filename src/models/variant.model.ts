import { model, Schema } from "mongoose";
import { IVariantDocument } from "../schema/variant.schema";

const VariantSchema = new Schema<IVariantDocument>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    size: { type: String, required: true },
    sku: { type: String, required: true, unique: true, index: true },
    price: { type: Number, required: true },
    discountPrice: { type: Number , default: 0 , min: 0 }, // For offers
    discountPercent : { type: Number , default: 0 , min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Generate SKU if missing
VariantSchema.pre("validate", async function (next) {
  if (!this.sku) {
    let uniqueSku = "";
    let isUnique = false;

    while (!isUnique) {
      const base = `P${this.productId.toString().slice(-5)}`;
      const sizePart = this.size.replace(/\s+/g, "").toUpperCase();
      const rand = Math.floor(1000 + Math.random() * 9000);
      uniqueSku = `${base}-${sizePart}-${rand}`;

      const exists = await model<IVariantDocument>("Variant").findOne({
        sku: uniqueSku,
      });
      if (!exists) isUnique = true;
    }

    this.sku = uniqueSku;
  }
  next();
});

// VariantSchema.pre("save", function (next) {
//   if (this?.discountPercent > 0) {
//     this.discountPrice = Math.round(
//       this.price - (this.price * this.discountPercent) / 100
//     );
//   } else {
//     this.discountPrice = 0;
//   }
//   next();
// });


// Indexes for better performance
VariantSchema.index({ productId: 1, size: 1 }, { unique: true });
VariantSchema.index({ price: 1 });
VariantSchema.index({ stock: 1 });

export default model<IVariantDocument>("Variant", VariantSchema);
