import rateLimit from "express-rate-limit";
import logger from "../utils/logger";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  handler: (req, res) => {
    logger.warn("Too many requests", {
      ip: req.ip,
      url: req.originalUrl,
      time: new Date().toISOString(),
    });
    res.status(429).json({
      error: "Too many requests - try again later.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default limiter;
