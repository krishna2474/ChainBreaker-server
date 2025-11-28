import express from 'express';
import { getProfile } from '../controllers/userController';
import { requireAuth } from '../middleware/requireAuth';

const router = express.Router();

// Protected Route: Only accessible if the user sends a valid token
router.get('/profile', requireAuth, getProfile);

export default router;