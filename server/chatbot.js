/**
 * chatbot.js — Chatbot integration module
 *
 * Single exported function:
 *   getChatbotResponse(userText, sessionId) → Promise<string>
 *
 * This is the ONLY file that knows which backend is answering.
 * The rest of the server calls this function and never looks inside.
 *
 * Current implementation: Hartnell Bedrock chatbot via its FastAPI endpoint.
 * POST /ask  — application/x-www-form-urlencoded — { query, pair_id }
 * Returns an HTML fragment; we strip tags to get plain text.
 *
 * To swap in a different backend later, replace the body of this file
 * without touching anything else.
 */

import https from 'https';
import querystring from 'querystring';
import { parse } from 'node-html-parser';

const CHATBOT_HOST = 'hartnell-gpt-alb-99053878.us-west-2.elb.amazonaws.com';
const CHATBOT_PATH = '/ask';

/**
 * Strip HTML tags and clean up whitespace from the bot's HTML fragment,
 * preserving link URLs inline so facts aren't lost.
 *
 * e.g. <a href="https://example.com">click here</a>
 *      → "click here (https://example.com)"
 */
function htmlToPlainText(html) {
  const root = parse(html);

  // Replace <a> tags with "text (url)" so URLs survive stripping
  root.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const text = a.text.trim();
    if (href && href !== text) {
      a.replaceWith(`${text} (${href})`);
    }
  });

  // Remove the thumbs-up/down feedback buttons — not part of the answer
  root.querySelectorAll('.feedback-buttons').forEach(el => el.remove());

  // Get the inner text of the .message-content div if present, else full text
  const contentEl = root.querySelector('.message-content');
  const raw = (contentEl ?? root).text;

  // Normalise whitespace: collapse runs of blanks, trim
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Make a POST /ask request to the Hartnell chatbot.
 * Returns the raw response body as a string.
 */
function postToHartnell(query, pairId) {
  return new Promise((resolve, reject) => {
    const body = querystring.stringify({ query, pair_id: pairId });

    const options = {
      hostname: CHATBOT_HOST,
      path: CHATBOT_PATH,
      method: 'POST',
      rejectUnauthorized: false, // ALB uses a self-signed cert
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Chatbot returned HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('Chatbot request timed out after 15s'));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Main exported interface.
 *
 * @param {string} userText   — the user's raw question
 * @param {string} sessionId  — unique per-session or per-message ID (used as pair_id)
 * @returns {Promise<string>} — plain-text answer from the chatbot
 */
export async function getChatbotResponse(userText, sessionId) {
  const html = await postToHartnell(userText, sessionId);
  return htmlToPlainText(html);
}
