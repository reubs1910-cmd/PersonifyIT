/**
 * routes/sessions.js — Session storage API
 *
 * POST /api/sessions  — save a complete session (rating + email + transcript)
 * GET  /api/sessions  — read stored sessions, filterable by rating
 *
 * One record per session — email, rating, reason, and transcript all live together.
 */

import { Router } from 'express';
import { saveSession, getSessions } from '../db.js';
import { sendTranscriptEmail } from '../email/ses.js';

const router = Router();

/**
 * POST /api/sessions
 * Body: { sessionId?, agentId, language, email?, rating, lowRatingReason?, transcript }
 */
router.post('/api/sessions', async (req, res) => {
  const { sessionId, agentId, language, email, rating, lowRatingReason, transcript } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be 1–5' });
  }

  try {
    const record = await saveSession({
      sessionId,
      agentId,
      language,
      email: email || null,
      rating,
      lowRatingReason: rating <= 2 ? (lowRatingReason || null) : null,
      transcript: transcript || [],
    });

    res.status(201).json({ session: record });

    // Fire-and-forget: send email if provided
    if (record.email && record.transcript.length > 0) {
      sendTranscriptEmail({
        to: record.email,
        language: record.language,
        transcript: record.transcript,
        agentId: record.agentId,
      }).catch((err) => console.error('[sessions] email send failed:', err.message));
    }
  } catch (err) {
    console.error('[sessions] save error:', err);
    res.status(500).json({ error: 'Failed to save session' });
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
    res.status(500).json({ error: 'Failed to read sessions' });
  }
});

export default router;
