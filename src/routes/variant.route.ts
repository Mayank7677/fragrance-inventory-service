import express from "express";
import {
    bulkUpdateStock,
  commitBulkDiscount,
  createVariant,
  createVariants,
  getAllVariants,
  getAllVariantsByIds,
  getVariantById,
  getVariantsByProduct,
  getVariantsByProductIds,
  prepareBulkDiscount,
  removeDiscountByProductId,
  removeDiscountByVariantId,
  removeDiscountFromProductService,
  rollbackBulkDiscount,
  updateDiscount,
  updateDiscountByProductId,
  updateStock,
  updateVariantStatus,
} from "../controllers/variant.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { isAdmin } from "../middlewares/admin.middleware";

const variantRouter = express.Router();

// create
variantRouter.post(
  "/create/:productId",
  authMiddleware,
  isAdmin,
  createVariant
);
variantRouter.post(
  "/bulk-create/:productId",
  authMiddleware,
  isAdmin,
  createVariants
);

// get
variantRouter.get("/all-by-variant-ids", getAllVariantsByIds);
variantRouter.get("/:variantId", getVariantById);
variantRouter.get("/by-product/:productId", getVariantsByProduct);
variantRouter.post("/by-product-ids", getVariantsByProductIds);
variantRouter.get("/", getAllVariants);

// update
variantRouter.patch(
  "/update-stock/:variantId",
  authMiddleware,
  isAdmin,
  updateStock
);
variantRouter.patch(
  "/bulk-update-stocks",
  authMiddleware,
  isAdmin,
  bulkUpdateStock
);

variantRouter.patch(
  "/update-discount/:variantId",
  authMiddleware,
  isAdmin,
  updateDiscount
);
variantRouter.patch(
  "/bulk-discount-by-product/:productId",
  authMiddleware,
  isAdmin,
  updateDiscountByProductId
);

// from product-service
// variantRouter.patch(
//   "/update-discount-by-collection",
//   authMiddleware,
//   isAdmin,
//   bulkUpdateDiscountFromProductService
// );
variantRouter.patch(
  "/remove-discount-by-collection",
  authMiddleware,
  isAdmin,
  removeDiscountFromProductService
);

// remove discount by variantId
variantRouter.patch(
  "/remove-discount-variant/:variantId",
  authMiddleware,
  isAdmin,
  removeDiscountByVariantId
);

// remove discount by productId
variantRouter.patch(
  "/remove-discount-product/:productId",
  authMiddleware,
  isAdmin,
  removeDiscountByProductId
);

// delete
variantRouter.patch(
  "/update-status/:variantId",
  authMiddleware,
  isAdmin,
  updateVariantStatus
);

// -------------------------------------------------------------------------------------

variantRouter.patch(
  "/update-discount-by-collection",
  authMiddleware,
  isAdmin,
  prepareBulkDiscount
);
variantRouter.post(
  "/commit-bulk-discount",
  authMiddleware,
  isAdmin,
  commitBulkDiscount
);
variantRouter.post(
  "/rollback-bulk-discount",
  authMiddleware,
  isAdmin,
  rollbackBulkDiscount
);

export default variantRouter;
