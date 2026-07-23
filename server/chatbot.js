/**
 * chatbot.js — AWS Bedrock Knowledge Base (RAG) integration
 *
 * Single exported function:
 *   getChatbotResponse(userText, sessionId) → Promise<string>
 *
 * Calls the Bedrock RetrieveAndGenerate API with the Hartnell College
 * knowledge base. Returns a plain-text answer grounded in the KB documents.
 *
 * Environment variables required:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 *   BEDROCK_KNOWLEDGE_BASE_ID, BEDROCK_MODEL_ARN
 *   BEDROCK_GUARDRAIL_ID, BEDROCK_GUARDRAIL_VERSION (optional)
 */

import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

// ─── Client setup ─────────────────────────────────────────────────────────────

const client = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ─── Build the model ARN ──────────────────────────────────────────────────────

function getModelArn() {
  const model = process.env.BEDROCK_MODEL_ARN || 'us.amazon.nova-pro-v1:0';
  // If it's already a full ARN, use as-is
  if (model.startsWith('arn:')) return model;
  // The API accepts bare model IDs directly (e.g. us.amazon.nova-pro-v1:0)
  return model;
}

// ─── Main exported interface ──────────────────────────────────────────────────

/**
 * @param {string} userText   — the user's raw question
 * @param {string} sessionId  — unique per-session ID (maintains conversation context)
 * @returns {Promise<string>} — plain-text answer from the knowledge base
 */
export async function getChatbotResponse(userText, sessionId) {
  const knowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID;
  const modelArn        = getModelArn();

  if (!knowledgeBaseId) {
    throw new Error('BEDROCK_KNOWLEDGE_BASE_ID is not set in .env');
  }

  const input = {
    input: { text: userText },
    retrieveAndGenerateConfiguration: {
      type: 'KNOWLEDGE_BASE',
      knowledgeBaseConfiguration: {
        knowledgeBaseId,
        modelArn,
      },
    },
  };

  // Note: sessionId is intentionally omitted for single-turn queries.
  // Bedrock creates a session on first call and returns it in the response.
  // For multi-turn conversations, store and pass the returned sessionId.

  // Add guardrail if configured
  const guardrailId      = process.env.BEDROCK_GUARDRAIL_ID;
  const guardrailVersion = process.env.BEDROCK_GUARDRAIL_VERSION;
  if (guardrailId) {
    input.retrieveAndGenerateConfiguration.knowledgeBaseConfiguration.guardrailConfiguration = {
      guardrailId,
      guardrailVersion: guardrailVersion || 'DRAFT',
    };
  }

  console.log(`[chatbot] querying Bedrock KB (model=${modelArn}, kb=${knowledgeBaseId})`);

  try {
    const command  = new RetrieveAndGenerateCommand(input);
    const response = await client.send(command);

    const answer = response.output?.text;
    if (!answer) {
      console.warn('[chatbot] Bedrock returned no text in output');
      return 'I could not find an answer to that question. Please contact the IT Help Desk for assistance.';
    }

    console.log(`[chatbot] got ${answer.length} chars from Bedrock`);
    return answer;
  } catch (err) {
    console.error('[chatbot] Bedrock error:', err.message);
    throw err;
  }
}
