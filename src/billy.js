import Anthropic from "@anthropic-ai/sdk";
import { findMemberByPhone } from "./config.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.BILLY_MODEL || "claude-sonnet-4-6";

// BillyAI's persona. This is a placeholder — replace/extend with the real
// voice, facts and boundaries once Billy's backend doc arrives.
const SYSTEM_PROMPT = `You are BillyAI, a WhatsApp "clone" of Billy talking to his team.
- Speak in Billy's voice: warm, direct, encouraging, lightly informal.
- You help teammates, answer questions, and nudge them about their work.
- Keep replies short and chat-friendly (this is WhatsApp, not email).
- If you don't know something only the real Billy would know, say so honestly
  and offer to flag it for him rather than inventing an answer.`;

// Very small in-memory conversation history keyed by phone number.
// For production, persist this (Railway volume / DB) so it survives restarts.
const histories = new Map();
const MAX_TURNS = 12; // keep the last N messages per person

function remember(phone, role, content) {
  const h = histories.get(phone) ?? [];
  h.push({ role, content });
  while (h.length > MAX_TURNS) h.shift();
  histories.set(phone, h);
}

/**
 * Generate BillyAI's reply to an inbound WhatsApp message.
 * @param {string} phone - sender's number
 * @param {string} text - their message
 * @returns {Promise<string>} reply text
 */
export async function reply(phone, text) {
  const member = findMemberByPhone(phone);
  const who = member
    ? `You are talking to ${member.name} (role: ${member.role}, team: ${member.team}).`
    : `You are talking to someone not yet in the team directory.`;

  remember(phone, "user", text);

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: `${SYSTEM_PROMPT}\n\n${who}`,
    messages: histories.get(phone),
  });

  const out = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  remember(phone, "assistant", out);
  return out || "…";
}
