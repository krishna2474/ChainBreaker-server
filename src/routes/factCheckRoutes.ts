import express from "express";
import { factCheck } from "../controllers/factCheckController";
// import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// Endpoint that your Telegram bot will call
router.post("/", factCheck);

export default router;