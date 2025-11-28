import express from 'express';
import { requireAuth } from '../middleware/requireAuth';

const router = express.Router();

// 1. Public Route (No Auth needed)
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 2. Protected Route (Requires Auth)
// This tests if your Supabase connection and middleware are working
router.get('/api/protected-test', requireAuth, (req:any, res:any) => {
  res.json({
    message: "You are authenticated!",
    user_id: req.user.id,
    email: req.user.email
  });
});

export default router;