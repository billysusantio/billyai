import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { findMemberByPhone } from "./config.js";
import { getRecentMessages, saveReminder, getSummary } from "./db.js";

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
  const nowISO = new Date().toISOString();
  const prompt = `Waktu sekarang (UTC, konversi ke WIB = UTC+7): ${nowISO}

Cek apakah pesan berikut adalah permintaan reminder/pengingat kepada asisten.
Kalau iya, tentukan kapan tepatnya reminder harus dikirim, dalam format ISO 8601 UTC.
Contoh: kalau sekarang 17:59 WIB dan user minta "jam 10 malem", fire_at = jam 22:00 WIB hari ini = konversi ke UTC (kurangi 7 jam) = 15:00:00Z.
Kalau user bilang "besok pagi jam 8", hitung berdasarkan tanggal besok.
Kalau user bilang "X menit lagi", tambahkan X menit dari sekarang.

Jawab HANYA dalam format JSON tanpa markdown:
{"isReminder": true, "fireAtISO": "2026-06-16T15:00:00.000Z", "message": "isi pesan reminder"}
Kalau bukan reminder, jawab: {"isReminder": false}

Pesan: "${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 150 },
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
  if (reminderCheck.isReminder && reminderCheck.fireAtISO) {
    const fireAt = new Date(reminderCheck.fireAtISO);
    if (!isNaN(fireAt.getTime()) && fireAt > new Date()) {
      const target = groupId || phone;
      await saveReminder({ target, message: `⏰ Reminder: ${reminderCheck.message}`, fireAt: fireAt.toISOString() });
      const fireWIB = fireAt.toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const confirmMsg = `Sip, gw ingetin lu soal "${reminderCheck.message}" pada ${fireWIB} WIB. ✅`;
      remember(phone, "user", text);
      remember(phone, "model", confirmMsg);
      return confirmMsg;
    }
  }

  let groupContext = "";
  if (groupId) {
    const [recent, summaryData] = await Promise.all([
      getRecentMessages(groupId, 100).catch(() => []),
      getSummary(groupId).catch(() => null),
    ]);
    const parts = [];
    if (summaryData?.summary) {
      parts.push(`Ringkasan percakapan sebelumnya:\n${summaryData.summary}`);
    }
    if (recent.length > 0) {
      const lines = recent.map(m => `${m.sender_name || m.sender}: ${m.message}`).join("\n");
      parts.push(`100 pesan terbaru di grup:\n${lines}`);
    }
    if (parts.length > 0) {
      groupContext = `\n\n${parts.join("\n\n---\n\n")}`;
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
