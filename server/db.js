/**
 * db.js — DynamoDB store for session data.
 *
 * Single table (PersonifyIT-Sessions) shared by two independent features,
 * kept separate INSIDE the table via a `recordType` discriminator:
 *
 *   recordType: "rating"      → { rating, lowRatingReason }        (rating feature)
 *   recordType: "transcript"  → { email, transcript }             (email feature)
 *
 * Both record types share a `sessionId` so they can be correlated later.
 * Each row's partition key `id` is unique per record.
 *
 * All persistence lives behind this one module — to swap DynamoDB for
 * Postgres later, only this file changes.
 *
 * Environment variables (DYNAMO_ prefix, separate from Bedrock creds):
 *   DYNAMO_ACCESS_KEY_ID, DYNAMO_SECRET_ACCESS_KEY, DYNAMO_SESSION_TOKEN (optional)
 *   DYNAMO_REGION, DYNAMO_TABLE_NAME
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

// ─── Client setup ─────────────────────────────────────────────────────────────

const credentials = {
  accessKeyId: process.env.DYNAMO_ACCESS_KEY_ID,
  secretAccessKey: process.env.DYNAMO_SECRET_ACCESS_KEY,
  ...(process.env.DYNAMO_SESSION_TOKEN && {
    sessionToken: process.env.DYNAMO_SESSION_TOKEN,
  }),
};

const client = new DynamoDBClient({
  region: process.env.DYNAMO_REGION || 'us-west-2',
  credentials,
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMO_TABLE_NAME || 'PersonifyIT-Sessions';

// Record type discriminators — keep the two features' data separate in one table.
export const RECORD_TYPES = {
  RATING: 'rating',
  TRANSCRIPT: 'transcript',
};

// ─── Rating feature ───────────────────────────────────────────────────────────

/**
 * Save a rating record (rating feature).
 *
 * @param {object} data
 * @param {string} [data.sessionId]  — correlates with the transcript record
 * @param {string} data.agentId
 * @param {string} data.language
 * @param {number} data.rating        — 1–5
 * @param {string|null} data.lowRatingReason
 * @returns {object} the saved record
 */
export async function saveSession(data) {
  const record = {
    id: randomUUID(),
    recordType: RECORD_TYPES.RATING,
    sessionId: data.sessionId || null,
    agentId: data.agentId || 'alex-it-support',
    language: data.language || 'en',
    rating: data.rating,
    lowRatingReason: data.lowRatingReason || null,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: record }));
  console.log(`[db] rating ${record.id} saved (rating=${record.rating}, session=${record.sessionId})`);
  return record;
}

// ─── Email / transcript feature ─────────────────────────────────────────────

/**
 * Save a transcript record (email feature).
 *
 * @param {object} data
 * @param {string} [data.sessionId]  — correlates with the rating record
 * @param {string} data.agentId
 * @param {string} data.language
 * @param {string|null} data.email
 * @param {Array} data.transcript      — [{ role, text, ts }]
 * @returns {object} the saved record
 */
export async function saveTranscript(data) {
  const record = {
    id: randomUUID(),
    recordType: RECORD_TYPES.TRANSCRIPT,
    sessionId: data.sessionId || null,
    agentId: data.agentId || 'alex-it-support',
    language: data.language || 'en',
    email: data.email || null,
    transcript: data.transcript || [],
    createdAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: record }));
  console.log(`[db] transcript ${record.id} saved (email=${record.email ? 'yes' : 'none'}, msgs=${record.transcript.length}, session=${record.sessionId})`);
  return record;
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Get rating records, optionally filtered by rating range.
 */
export async function getSessions(filters = {}) {
  const expressions = ['recordType = :rt'];
  const exprValues = { ':rt': RECORD_TYPES.RATING };

  if (filters.minRating != null) {
    expressions.push('rating >= :minR');
    exprValues[':minR'] = filters.minRating;
  }
  if (filters.maxRating != null) {
    expressions.push('rating <= :maxR');
    exprValues[':maxR'] = filters.maxRating;
  }

  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: expressions.join(' AND '),
      ExpressionAttributeValues: exprValues,
    })
  );

  const sessions = result.Items || [];
  sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return sessions;
}

/**
 * Get transcript records (email feature). Optionally only those with an email.
 */
export async function getTranscripts(filters = {}) {
  const expressions = ['recordType = :rt'];
  const exprValues = { ':rt': RECORD_TYPES.TRANSCRIPT };

  if (filters.withEmailOnly) {
    expressions.push('attribute_exists(email) AND email <> :null');
    exprValues[':null'] = null;
  }

  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: expressions.join(' AND '),
      ExpressionAttributeValues: exprValues,
    })
  );

  const transcripts = result.Items || [];
  transcripts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return transcripts;
}
