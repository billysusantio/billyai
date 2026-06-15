import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { findMemberByPhone } from "./config.js";
import { getRecentMessages, saveReminder } from "./db.js";

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

async function detectReminder(text) {
  const prompt = `Cek apakah pesan berikut adalah permintaan reminder/pengingat kepada asisten.
Kalau iya, extract berapa menit dari sekarang dan isi pesannya.
Jawab HANYA dalam format JSON tanpa markdown, contoh:
{"isReminder": true, "minutesFromNow": 30, "message": "makan siang"}
Kalau bukan reminder, jawab: {"isReminder": false}

Pesan: "${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 100 },
    });
    const raw = (response.text ?? "").trim().replace(/```json|```/g, "").trim();
    return JSON.parse(raw);
  } catch {
    return { isReminder: false };
  }
}

export async function reply(phone, text, groupId = null) {
  const member = findMemberByPhone(phone);
  const who = member
    ? `You are talking to ${member.name} (role: ${member.role}, team: ${member.team}).`
    : `You are talking to someone not yet in the team directory.`;
  const now = `Waktu sekarang (WIB): ${getNowWIB()}.`;

  const reminderCheck = await detectReminder(text).catch(() => ({ isReminder: false }));
  if (reminderCheck.isReminder && reminderCheck.minutesFromNow > 0) {
    const fireAt = new Date(Date.now() + reminderCheck.minutesFromNow * 60 * 1000);
    const target = groupId || phone;
    await saveReminder({ target, message: `Reminder: ${reminderCheck.message}`, fireAt: fireAt.toISOString() });
    const confirmMsg = `Sip, gw ingetin lu soal "${reminderCheck.message}" ${reminderCheck.minutesFromNow} menit lagi. ✅`;
    remember(phone, "user", text);
    remember(phone, "model", confirmMsg);
    return confirmMsg;
  }

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
      maxOutputTokens: 500,
    },
  });
  const out = (response.text ?? "").trim();
  remember(phone, "model", out);
  return out || "…";
}
