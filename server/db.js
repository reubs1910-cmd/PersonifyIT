/**
 * db.js — Flat-file JSON store for session data (rating + transcript).
 *
 * Stores sessions in server/data/sessions.json.
 * No external DB dependency — easy to swap for a real DB later.
 * Only this file and routes/sessions.js know about the storage format.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');

async function ensureFile() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  if (!existsSync(SESSIONS_FILE)) {
    await writeFile(SESSIONS_FILE, '[]', 'utf-8');
  }
}

async function readSessions() {
  await ensureFile();
  const raw = await readFile(SESSIONS_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeSessions(sessions) {
  await ensureFile();
  await writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}

/**
 * Save a completed session.
 *
 * @param {object} data
 * @param {string} data.agentId
 * @param {string} data.language
 * @param {string|null} data.email
 * @param {number} data.rating        — 1–5
 * @param {string|null} data.lowRatingReason
 * @param {Array} data.transcript      — [{ role, text, ts }]
 * @returns {object} the saved session (with id + createdAt)
 */
export async function saveSession(data) {
  const session = {
    id: randomUUID(),
    agentId: data.agentId || 'alex-it-support',
    language: data.language || 'en',
    email: data.email || null,
    rating: data.rating,
    lowRatingReason: data.lowRatingReason || null,
    transcript: data.transcript || [],
    createdAt: new Date().toISOString(),
  };

  const sessions = await readSessions();
  sessions.push(session);
  await writeSessions(sessions);

  return session;
}

/**
 * Get stored sessions, optionally filtered by rating range.
 *
 * @param {object} filters
 * @param {number} [filters.minRating]
 * @param {number} [filters.maxRating]
 * @returns {Array} matching sessions
 */
export async function getSessions(filters = {}) {
  let sessions = await readSessions();

  if (filters.minRating != null) {
    sessions = sessions.filter(s => s.rating >= filters.minRating);
  }
  if (filters.maxRating != null) {
    sessions = sessions.filter(s => s.rating <= filters.maxRating);
  }

  // Most recent first
  sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return sessions;
}
