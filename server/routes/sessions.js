/**
 * routes/sessions.js — Rating API (rating feature)
 *
 * POST /api/sessions  — save a rating (rating + reason + sessionId)
 * GET  /api/sessions  — read ratings, filterable by rating range
 *
 * Transcript + email are handled separately in routes/transcript.js.
 */

import { Router } from 'express';
import { saveSession, getSessions } from '../db.js';

const router = Router();

/**
 * POST /api/sessions
 * Body: { sessionId?, agentId, language, rating, lowRatingReason? }
 */
router.post('/api/sessions', async (req, res) => {
  const { sessionId, agentId, language, rating, lowRatingReason } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be 1–5' });
  }

  try {
    const record = await saveSession({
      sessionId,
      agentId,
      language,
      rating,
      lowRatingReason: rating <= 2 ? (lowRatingReason || null) : null,
    });
    res.status(201).json({ session: record });
  } catch (err) {
    console.error('[sessions] save error:', err);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

/**
 * GET /api/sessions?minRating=1&maxRating=2
 */
router.get('/api/sessions', async (req, res) => {
  const minRating = req.query.minRating ? parseInt(req.query.minRating, 10) : undefined;
  const maxRating = req.query.maxRating ? parseInt(req.query.maxRating, 10) : undefined;

  try {
    const sessions = await getSessions({ minRating, maxRating });
    res.json({ sessions, count: sessions.length });
  } catch (err) {
    console.error('[sessions] read error:', err);
    res.status(500).json({ error: 'Failed to read ratings' });
  }
});

export default router;
