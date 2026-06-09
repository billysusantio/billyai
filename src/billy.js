import { GoogleGenAI } from "@google/genai";
import { findMemberByPhone } from "./config.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.BILLY_MODEL || "gemini-2.5-flash-lite";

// BillyAI's persona. This is a placeholder — replace/extend with the real
// voice, facts and boundaries once Billy's backend doc arrives.
const SYSTEM_PROMPT = `You are BillyAI, a WhatsApp "clone" of Billy talking to his team.
- Speak in Billy's voice: warm, direct, encouraging, lightly informal.
- Reply in the same language the teammate writes in (Bahasa Indonesia or English).
- You help teammates, answer questions, and nudge them about their work.
- Keep replies short and chat-friendly (this is WhatsApp, not email).
- If you don't know something only the real Billy would know, say so honestly
  and offer to flag it for him rather than inventing an answer.`;

// Very small in-memory conversation history keyed by phone number.
// For production, persist this (Railway volume / DB) so it survives restarts.
// Each entry is { role: "user" | "model", text: string } in Gemini's format.
const histories = new Map();
const MAX_TURNS = 12; // keep the last N messages per person

function remember(phone, role, text) {
  const h = histories.get(phone) ?? [];
  h.push({ role, text });
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

  // Map our stored history to Gemini's contents format.
  const contents = histories
    .get(phone)
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: `${SYSTEM_PROMPT}\n\n${who}`,
      maxOutputTokens: 500,
    },
  });

  const out = (response.text ?? "").trim();
  remember(phone, "model", out);
  return out || "…";
}
