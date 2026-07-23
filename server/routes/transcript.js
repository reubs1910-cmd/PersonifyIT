/**
 * routes/transcript.js — Transcript + email capture API (email feature)
 *
 * POST /api/transcript  — store the session transcript + optional email.
 *                         Returns immediately (does not block on summarize/send).
 * GET  /api/transcript  — read stored transcripts (for the later summary+email step).
 *
 * Summarization (Bedrock) and sending (SES) are deferred — this endpoint
 * only persists for now. When those are added, they'll be kicked off here
 * as fire-and-forget AFTER the response is sent.
 */

import { Router } from 'express';
import { saveTranscript, getTranscripts } from '../db.js';
import { sendTranscriptEmail } from '../email/ses.js';

const router = Router();

/**
 * POST /api/transcript
 * Body: { sessionId?, agentId, language, email?, transcript: [{role,text,ts}] }
 */
router.post('/api/transcript', async (req, res) => {
  const { sessionId, agentId, language, email, transcript } = req.body;

  if (!Array.isArray(transcript)) {
    return res.status(400).json({ error: 'transcript must be an array' });
  }

  try {
    const record = await saveTranscript({
      sessionId,
      agentId,
      language,
      email: email || null,
      transcript,
    });

    // Respond immediately — the user is not blocked on summarize/send.
    res.status(201).json({ transcript: { id: record.id, sessionId: record.sessionId } });

    // ── Fire-and-forget: if an email was given, send the transcript.
    if (record.email) {
      sendTranscriptEmail({
        to: record.email,
        language: record.language,
        transcript: record.transcript,
        agentId: record.agentId,
      }).catch((err) => console.error('[transcript] email send failed:', err.message));
    }
  } catch (err) {
    console.error('[transcript] save error:', err);
    res.status(500).json({ error: 'Failed to save transcript' });
  }
});

/**
 * GET /api/transcript?withEmailOnly=true
 */
router.get('/api/transcript', async (req, res) => {
  const withEmailOnly = req.query.withEmailOnly === 'true';

  try {
    const transcripts = await getTranscripts({ withEmailOnly });
    res.json({ transcripts, count: transcripts.length });
  } catch (err) {
    console.error('[transcript] read error:', err);
    res.status(500).json({ error: 'Failed to read transcripts' });
  }
});

export default router;
