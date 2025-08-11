import express from "express";
import {
  createVariant,
  getAllVariants,
  getVariantById,
  getVariantsByProduct,
  updateDiscount,
  updateStock,
  updateVariantStatus,
} from "../controllers/variant.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { isAdmin } from "../middlewares/admin.middleware";

const variantRouter = express.Router();

variantRouter.post("/create/:productId", authMiddleware, isAdmin, createVariant);
variantRouter.get("/:variantId", getVariantById);
variantRouter.get("/by-product/:productId", getVariantsByProduct);
variantRouter.get("/", getAllVariants);
variantRouter.patch(
  "/update-stock/:variantId",
  authMiddleware,
  isAdmin,
  updateStock
);
variantRouter.patch(
  "/update-discount/:variantId",
  authMiddleware,
  isAdmin,
  updateDiscount
);
variantRouter.patch(
  "/update-status/:variantId",
  authMiddleware,
  isAdmin,
  updateVariantStatus
);

export default variantRouter;
