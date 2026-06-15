import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { findMemberByPhone } from "./config.js";
import { getRecentMessages } from "./db.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.BILLY_MODEL || "gemini-2.5-flash-lite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PERSONA = readFileSync(join(__dirname, "../config/billy-persona.md"), "utf-8");

const SYSTEM_PROMPT = `You are Bilbot — a WhatsApp AI clone of Billy, built to talk to his team at Cartiera.

Use the persona, context, and knowledge below to guide every response.

${PERSONA}

Additional rules:
- Reply in the same language the teammate writes in (Bahasa Indonesia or English).
- Keep replies short and chat-friendly (this is WhatsApp, not email).
- If asked about something only the real Billy would know, say you're not sure and suggest asking Billy directly.
- Never make up facts about the business.`;

const histories = new Map();
const MAX_TURNS = 12;

function remember(phone, role, text) {
  const h = histories.get(phone) ?? [];
  h.push({ role, text });
  while (h.length > MAX_TURNS) h.shift();
  histories.set(phone, h);
}

function getNowWIB() {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function reply(phone, text, groupId = null) {
  const member = findMemberByPhone(phone);
  const who = member
    ? `You are talking to ${member.name} (role: ${member.role}, team: ${member.team}).`
    : `You are talking to someone not yet in the team directory.`;
  const now = `Waktu sekarang (WIB): ${getNowWIB()}.`;

  // Inject recent group conversation as memory context
  let groupContext = "";
  if (groupId) {
    const recent = await getRecentMessages(groupId, 30).catch(() => []);
    if (recent.length > 0) {
      const lines = recent.map(m => `${m.sender_name || m.sender}: ${m.message}`).join("\n");
      groupContext = `\n\nBerikut adalah 30 pesan terakhir di grup ini (untuk konteks):\n${lines}`;
    }
  }

  remember(phone, "user", text);
  const contents = histories.get(phone).map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: `${SYSTEM_PROMPT}\n\n${who}\n${now}${groupContext}`,
      maxOutputTokens: 500
    },
  });
  const out = (response.text ?? "").trim();
  remember(phone, "model", out);
  return out || "…";
}
