import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import Variant from "../models/variant.model";
import { AppError } from "../utils/appError";
import { AuthenticatedRequest } from "../middlewares/admin.middleware";
import { IVariantDocument } from "../schema/variant.schema";
import axios from "axios";

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

// Update discount
export const updateDiscount = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { variantId } = req.params;
    const { discountPercent  } = req.body;

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



// TO-DO => bulkUpdateStock 