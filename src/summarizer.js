import { GoogleGenAI } from "@google/genai";
import { getSummary, saveSummary, getOldMessages } from "./db.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.BILLY_MODEL || "gemini-2.5-flash-lite";
const COOLDOWN_MS = 60 * 60 * 1000; // 1 jam

export async function maybeSummarize(groupId) {
  try {
    const existing = await getSummary(groupId);
    if (existing) {
      const age = Date.now() - new Date(existing.updated_at).getTime();
      if (age < COOLDOWN_MS) return;
    }

    const oldMessages = await getOldMessages(groupId, 100, 300);
    if (oldMessages.length === 0) return;

    const lines = oldMessages.map(m => `${m.sender_name || "?"}: ${m.message}`).join("\n");
    const prompt = `Berikut adalah log percakapan WhatsApp dari grup bisnis Cartiera (men's fashion brand).
Buat ringkasan singkat dalam Bahasa Indonesia (max 300 kata) yang mencakup:
- Topik-topik utama yang dibahas
- Keputusan atau rencana penting
- Konteks bisnis yang relevan untuk dipahami Bilbot (AI assistant)

Log percakapan:
${lines}

Ringkasan:`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 400 },
    });

    const summary = (response.text ?? "").trim();
    if (summary) {
      await saveSummary(groupId, summary);
      console.log(`[summarizer] updated summary for group ${groupId}`);
    }
  } catch (err) {
    console.error("[summarizer] error:", err.message);
  }
}
