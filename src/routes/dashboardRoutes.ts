import express from "express";
// import { factCheck } from "../controllers/factCheckController";
import { dashboardController } from "../controllers/dashboardController";
// import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// Endpoint that your Telegram bot will call
router.get("/", dashboardController);

export default router;