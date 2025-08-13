import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import Variant from "../models/variant.model";
import { AppError } from "../utils/appError";
import { AuthenticatedRequest } from "../middlewares/admin.middleware";
import { IVariantDocument } from "../schema/variant.schema";
import axios from "axios";
import { startSession, Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import Audit from "../models/audit.model";
import logger from "../utils/logger";

interface StockUpdate {
  variantId: string;
  quantity: number;
  type: "increase" | "decrease" | "set"; // Add = increase, Reduce = decrease, Set = overwrite
}

export const createVariant = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { productId } = req.params;
    const { size, price, stock } = req.body;

    if (!productId) next(new AppError("Product ID is required", 400));

    // check product exists or not
    const productResponse = await axios.get(
      `${process.env.PRODUCT_SERVICE_URL}/api/products/${productId}`
    );
    if (!productResponse.data) next(new AppError("Product not found", 404));

    if (!size || !price || !stock)
      next(new AppError("Size, Price and Stock are required", 400));

    // check size
    const existingVariant = await Variant.findOne({ productId, size });
    if (existingVariant) next(new AppError("Variant already exists", 400));

    // create Variant
    const variant = await Variant.create({
      productId,
      size,
      price,
      stock,
      createdBy: req.user?.userId,
    });

    if (!variant) next(new AppError("Failed to create variant", 500));

    res.status(201).json({ message: "Variant created successfully", variant });
  }
);

export const createVariants = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { productId } = req.params;
    const { variants } = req.body; // Expecting [{ size, price, stock }, ...]

    if (!productId) return next(new AppError("Product ID is required", 400));

    if (!Array.isArray(variants) || variants.length === 0) {
      return next(new AppError("Variants array is required", 400));
    }

    // Check if product exists in Product Service
    const productResponse = await axios.get(
      `${process.env.PRODUCT_SERVICE_URL}/api/products/${productId}`
    );
    if (!productResponse.data) {
      return next(new AppError("Product not found", 404));
    }

    // Validate each variant payload
    for (const variant of variants) {
      if (!variant.size || typeof variant.size !== "string") {
        return next(new AppError("Each variant must have a valid size", 400));
      }
      if (variant.price == null || variant.price <= 0) {
        return next(new AppError("Each variant must have a valid price", 400));
      }
      if (variant.stock == null || variant.stock < 0) {
        return next(new AppError("Each variant must have a valid stock", 400));
      }
    }

    // Prevent duplicates in request payload
    const sizesInRequest = variants.map((v) => v.size);
    const hasDuplicateInRequest =
      new Set(sizesInRequest).size !== sizesInRequest.length;
    if (hasDuplicateInRequest) {
      return next(
        new AppError("Duplicate sizes found in request payload", 400)
      );
    }

    // Prevent duplicates in DB
    const existingVariants = await Variant.find({
      productId,
      size: { $in: sizesInRequest },
    }).select("size");

    if (existingVariants.length > 0) {
      const existingSizes = existingVariants.map((v) => v.size);
      return next(
        new AppError(
          `Variants with sizes already exist: ${existingSizes.join(", ")}`,
          400
        )
      );
    }

    // Start transaction
    const session = await startSession();
    session.startTransaction();

    try {
      const createdVariants = await Variant.insertMany(
        variants.map((v) => ({
          productId,
          size: v.size,
          price: v.price,
          stock: v.stock,
          createdBy: req.user?.userId,
        })),
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      res.status(201).json({
        message: "Variants created successfully",
        variants: createdVariants,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(new AppError("Failed to create variants", 500));
    }
  }
);

// Get variants by product
export const getVariantsByProduct = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { productId } = req.params;

    if (!productId) next(new AppError("Product ID is required", 400));

    // check product exists or not
    const productResponse = await axios.get(
      `${process.env.PRODUCT_SERVICE_URL}/api/products/${productId}`
    );
    if (!productResponse.data) next(new AppError("Product not found", 404));

    const variants = await Variant.find({ productId });

    res.status(200).json({ variants });
  }
);

export const getVariantsByProductIds = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return next(new AppError("productIds array is required", 400));
    }

    const variants = await Variant.find({ productId: { $in: productIds } });

    res.status(200).json({ variants });
  } catch (err) {
    next(err);
  }
};

// Get variant by ID
export const getVariantById = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { variantId } = req.params;

    if (!variantId) next(new AppError("Variant ID is required", 400));

    const variant = await Variant.findById(variantId);

    if (!variant) next(new AppError("Variant not found", 404));

    res.status(200).json({ variant });
  }
);

// Get all variants
export const getAllVariants = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      page = 1,
      limit = 10,
      size,
      minPrice,
      maxPrice,
      inStock,
      isActive,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query: any = {};

    // Filtering by size
    if (size) {
      query.size = { $regex: new RegExp(size as string, "i") };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // In-stock filter
    if (inStock) {
      query.stock = inStock === "true" ? { $gt: 0 } : { $lte: 0 };
    }

    // Active status filter
    if (isActive) {
      query.isActive = isActive === "true";
    }

    // Search by SKU
    if (search) {
      query.sku = { $regex: new RegExp(search as string, "i") };
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Sorting
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const variants = await Variant.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const total = await Variant.countDocuments(query);

    res.status(200).json({
      message: "Variants fetched successfully",
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
      variants,
    });
  }
);

// Update stock
export const updateStock = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { variantId } = req.params;
    const { stock } = req.body;

    if (!variantId) next(new AppError("Variant ID is required", 400));

    const variant: IVariantDocument | null = await Variant.findById(variantId);

    if (!variant) next(new AppError("Variant not found", 404));

    if (variant) {
      variant.stock += stock;
      await variant.save();
      res.status(200).json({ message: "Stock updated successfully", variant });
    }

    next(new AppError("Failed to update stock", 500));
  }
);

// Update discount => single variant
export const updateDiscount = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { variantId } = req.params;
    const { discountPercent } = req.body;

    if (discountPercent < 0 || discountPercent > 100) {
      return next(
        new AppError("Discount percent must be between 0 and 100", 400)
      );
    }

    const variant = await Variant.findById(variantId);
    if (!variant) {
      return next(new AppError("Variant not found", 404));
    }

    variant.discountPercent = discountPercent;
    variant.discountPrice =
      discountPercent > 0
        ? Math.round(variant.price - (variant.price * discountPercent) / 100)
        : 0;

    await variant.save();

    res.status(200).json({
      message: "Discount updated successfully",
      variant,
    });
  }
);

// update status
export const updateVariantStatus = catchAsync(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { variantId } = req.params;
    const { isActive } = req.body;

    if (!variantId) next(new AppError("Variant ID is required", 400));

    const variant: IVariantDocument | null = await Variant.findById(variantId);

    if (!variant) next(new AppError("Variant not found", 404));

    if (variant) {
      variant.isActive = isActive;
      await variant.save();
      res.status(200).json({ message: "Status updated successfully", variant });
    }

    next(new AppError("Failed to update status", 500));
  }
);

export const bulkUpdateStock = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const updates: StockUpdate[] = req.body.updates;

    if (!Array.isArray(updates) || updates.length === 0) {
      return next(new AppError("Updates array is required", 400));
    }

    const bulkOps = [];

    for (const update of updates) {
      const { variantId, quantity, type } = update;

      if (
        !variantId ||
        quantity == null ||
        !["increase", "decrease", "set"].includes(type)
      ) {
        return next(new AppError("Invalid update format", 400));
      }

      // Fetch current variant to validate
      const variant = await Variant.findById(variantId);
      if (!variant) {
        return next(new AppError(`Variant not found: ${variantId}`, 404));
      }

      let newStock = variant.stock;

      if (type === "increase") {
        newStock += quantity;
      } else if (type === "decrease") {
        if (variant.stock < quantity) {
          return next(
            new AppError(
              `Not enough stock to reduce for variant: ${variantId}`,
              400
            )
          );
        }
        newStock -= quantity;
      } else if (type === "set") {
        newStock = quantity;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: variantId },
          update: { $set: { stock: newStock } },
        },
      });
    }

    if (bulkOps.length === 0) {
      return next(new AppError("No valid stock updates found", 400));
    }

    await Variant.bulkWrite(bulkOps);

    res.status(200).json({
      message: "Stock updated successfully",
    });
  }
);

// update discount => by Product Id
export const updateDiscountByProductId = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { productId } = req.params;
    const { discountPercent } = req.body;

    if (!productId) {
      return next(new AppError("Product ID is required", 400));
    }

    if (discountPercent < 0 || discountPercent > 100) {
      return next(
        new AppError("Discount percent must be between 0 and 100", 400)
      );
    }

    // check product exists or not
    const productResponse = await axios.get(
      `${process.env.PRODUCT_SERVICE_URL}/api/products/${productId}`
    );
    if (!productResponse.data) next(new AppError("Product not found", 404));

    const variants = await Variant.find({ productId });
    if (variants.length === 0) {
      return next(new AppError("No variants found for this product", 404));
    }

    for (const variant of variants) {
      variant.discountPercent = discountPercent;
      variant.discountPrice =
        discountPercent > 0
          ? Math.round(variant.price - (variant.price * discountPercent) / 100)
          : 0;
      await variant.save();
    }

    res.status(200).json({
      message: "Discount updated successfully",
    });
  }
);

// bulk update discount from product-service
export const bulkUpdateDiscountFromProductService = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const session = await startSession();
    session.startTransaction();

    try {
      const { productIds, discountPercent } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new Error("Product IDs must be provided");
      }
      if (discountPercent < 0 || discountPercent > 100) {
        throw new Error("Discount percent must be between 0 and 100");
      }

      // Fetch variants
      const variants = await Variant.find({
        productId: { $in: productIds },
      }).session(session);

      for (const variant of variants) {
        const discountAmount = (variant.price * discountPercent) / 100;
        variant.discountPercent = discountPercent;
        variant.discountPrice = Math.round(variant.price - discountAmount);
        await variant.save({ session });
      }

      await session.commitTransaction();
      return res
        .status(200)
        .json({ message: "Discount updated for all variants", success: true });
    } catch (error) {
      await session.abortTransaction();
      return next(new AppError("Failed to update discount", 400));
    } finally {
      session.endSession();
    }
  }
);

// bulk update discount from product-service
export const removeDiscountFromProductService = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const session = await startSession();
    session.startTransaction();

    try {
      const { productIds } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new Error("Product IDs must be provided");
      }

      // Fetch variants
      const variants = await Variant.find({
        productId: { $in: productIds },
      }).session(session);

      for (const variant of variants) {
        variant.discountPercent = 0;
        variant.discountPrice = 0;
        await variant.save({ session });
      }

      await session.commitTransaction();
      return res
        .status(200)
        .json({ message: "Discount removed for all variants", success: true });
    } catch (error) {
      await session.abortTransaction();
      return next(new AppError("Failed to remove discount", 400));
    } finally {
      session.endSession();
    }
  }
);

// Remove discount by variantId
export const removeDiscountByVariantId = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { variantId } = req.params;

    const variant = await Variant.findById(variantId);
    if (!variant) {
      return next(new AppError("Variant not found", 404));
    }

    // Reset discount
    variant.discountPercent = 0;
    variant.discountPrice = 0;

    await variant.save();

    res.status(200).json({
      message: "Discount removed successfully",
      variant,
    });
  }
);

//remove dicount by productId
export const removeDiscountByProductId = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { productId } = req.params;

    if (!productId) next(new AppError("Product ID is required", 400));

    // check product exists or not
    const productResponse = await axios.get(
      `${process.env.PRODUCT_SERVICE_URL}/api/products/${productId}`
    );
    if (!productResponse.data) next(new AppError("Product not found", 404));

    const variants = await Variant.find({ productId });
    if (variants.length === 0) {
      return next(new AppError("No variants found for this product", 404));
    }

    for (const variant of variants) {
      variant.discountPercent = 0;
      variant.discountPrice = 0;
      await variant.save();
    }

    res.status(200).json({
      message: "Discount removed successfully",
    });
  }
);

export const bulkRemoveDiscount = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { updates } = req.body;
    // updates: [{ variantId: "...", remove: true }, ...]

    if (!Array.isArray(updates) || updates.length === 0) {
      return next(new AppError("No updates provided", 400));
    }

    const bulkOps = updates.map(({ variantId }) => ({
      updateOne: {
        filter: { _id: variantId },
        update: {
          $set: {
            discountPercent: 0,
            discountPrice: 0,
          },
        },
      },
    }));

    const result = await Variant.bulkWrite(bulkOps);

    res.status(200).json({
      message: "Discounts removed successfully",
      modifiedCount: result.modifiedCount,
    });
  }
);

/**
 * Prepare bulk discount.
 * - Validate body: productIds[], discountPercent
 * - Find matching variants and snapshot old discount fields
 * - In a transaction: update variants with new discount (discountPercent + discountPrice)
 * - Save an Audit doc with status 'pending' and the old values (items)
 * - Return operationId to caller
 */

export const prepareBulkDiscount = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // internal auth check
    if (req.headers["x-internal-key"] !== process.env.INTERNAL_API_KEY) {
      return next(new AppError("Unauthorized", 403));
    }

    const { productIds, discountPercent, initiatedBy } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return next(new AppError("productIds required", 400));
    }
    if (
      typeof discountPercent !== "number" ||
      discountPercent < 0 ||
      discountPercent > 100
    ) {
      return next(new AppError("discountPercent must be 0..100", 400));
    }

    const session = await startSession();
    session.startTransaction();

    try {
      // fetch variants for those products
      const variants = await Variant.find({
        productId: { $in: productIds },
      }).session(session);
      if (!variants.length) {
        await session.abortTransaction();
        return next(new AppError("No variants found for given products", 404));
      }

      // prepare audit items with old values
      const items = variants.map((v) => ({
        variantId: v._id,
        oldDiscountPercent: v.discountPercent || 0,
        oldDiscountPrice: v.discountPrice || 0,
      }));

      // compute new discountPrice and update each variant
      const bulkOps = variants.map((v) => {
        const newDiscountPrice =
          discountPercent > 0
            ? Math.round(v.price - (v.price * discountPercent) / 100)
            : 0;
        return {
          updateOne: {
            filter: { _id: v._id },
            update: {
              $set: { discountPercent, discountPrice: newDiscountPrice },
            },
          },
        };
      });

      if (bulkOps.length) {
        await Variant.bulkWrite(bulkOps, { session });
      }

      // save audit record
      const operationId = uuidv4();
      logger.info(`Bulk discount operationId: ${operationId}`);
      const audit = await Audit.create(
        [
          {
            operationId,
            productIds,
            variantCount: variants.length,
            discountPercent,
            status: "pending",
            createdBy: initiatedBy || null,
            items,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ operationId, variantCount: variants.length });
    } catch (err: any) {
      await session.abortTransaction();
      session.endSession();
      return next(
        new AppError("Failed preparing bulk discount: " + err.message, 500)
      );
    }
  }
);

/**
 * Commit: mark the pending audit as committed (finalize)
 */
export const commitBulkDiscount = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.headers["x-internal-key"] !== process.env.INTERNAL_API_KEY) {
      return next(new AppError("Unauthorized", 403));
    }

    const { operationId } = req.body;
    logger.info(`Committing bulk discount operationId: ${operationId}`);
    if (!operationId) return next(new AppError("operationId required", 400));

    const audit = await Audit.findOne({ operationId });
    if (!audit) return next(new AppError("Operation not found", 404));
    if (audit.status !== "pending")
      return next(new AppError("Operation not pending", 400));

    audit.status = "committed";
    await audit.save();

    res.status(200).json({ message: "Committed", operationId });
  }
);

/**
 * Rollback: revert changes using audit.items (must be called if Product Service fails)
 */
export const rollbackBulkDiscount = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.headers["x-internal-key"] !== process.env.INTERNAL_API_KEY) {
      return next(new AppError("Unauthorized", 403));
    }

    const { operationId } = req.body;
    if (!operationId) return next(new AppError("operationId required", 400));

    const session = await startSession();
    session.startTransaction();

    try {
      const audit = await Audit.findOne({ operationId });
      if (!audit) return next(new AppError("Operation not found", 404));
      if (audit.status !== "pending")
        return next(new AppError("Operation not pending", 400));

      const items = audit.items;
      const bulkOps = items.map((item) => {
        return {
          updateOne: {
            filter: { _id: item.variantId },
            update: {
              $set: {
                discountPercent: item.oldDiscountPercent,
                discountPrice: item.oldDiscountPrice,
              },
            },
          },
        };
      });

      if (bulkOps.length) {
        await Variant.bulkWrite(bulkOps, { session });
      }

      audit.status = "rolledback";
      await audit.save();

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ message: "Rolledback successfully", operationId });
    } catch (error: any) {
      await session.abortTransaction();
      session.endSession();
      return next(
        new AppError("Failed rolling back bulk discount: " + error.message, 500)
      );
    }
  }
);

export const getAllVariantsByIds = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const ids = (req.query.variantIds as string)?.split(",") || [];

    // Convert all IDs to Mongo ObjectId type
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    console.log(objectIds);
    const variants = await Variant.find({ _id: { $in: objectIds } });
    res.status(200).json({ variants });
  }
);
