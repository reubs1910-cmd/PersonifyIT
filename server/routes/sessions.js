/**
 * routes/sessions.js — Session storage API (rating + transcript feature)
 *
 * POST /api/sessions  — save a completed session (transcript + rating + email)
 * GET  /api/sessions  — read stored sessions, filterable by rating
 *
 * This file is self-contained. Only touches db.js for persistence.
 */

import { Router } from 'express';
import { saveSession, getSessions } from '../db.js';

const router = Router();

/**
 * POST /api/sessions
 * Body: { agentId, language, email?, rating, lowRatingReason?, transcript }
 */
router.post('/api/sessions', async (req, res) => {
  const { agentId, language, email, rating, lowRatingReason, transcript } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be 1–5' });
  }
  if (!Array.isArray(transcript)) {
    return res.status(400).json({ error: 'transcript must be an array' });
  }

  try {
    const session = await saveSession({
      agentId,
      language,
      email: email || null,
      rating,
      lowRatingReason: rating <= 2 ? (lowRatingReason || null) : null,
      transcript,
    });
    res.status(201).json({ session });
  } catch (err) {
    console.error('[sessions] save error:', err);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

/**
 * GET /api/sessions?minRating=1&maxRating=2
 * Returns sessions filtered by rating range. Defaults to all.
 */
router.get('/api/sessions', async (req, res) => {
  const minRating = req.query.minRating ? parseInt(req.query.minRating, 10) : undefined;
  const maxRating = req.query.maxRating ? parseInt(req.query.maxRating, 10) : undefined;

  try {
    const sessions = await getSessions({ minRating, maxRating });
    res.json({ sessions, count: sessions.length });
  } catch (err) {
    console.error('[sessions] read error:', err);
    res.status(500).json({ error: 'Failed to read sessions' });
  }
});

export default router;
