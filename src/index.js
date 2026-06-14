import "dotenv/config";
import express from "express";
import { reply } from "./billy.js";
import { sendMessage, getGroups } from "./fonnte.js";
import { startReminders } from "./reminders.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const BOT_NUMBER = process.env.BOT_NUMBER || "6287811808680";
const BOT_LID = process.env.BOT_LID || "224146457903221";

app.get("/", (_req, res) => res.send("BillyAI is awake 🤖"));

app.get("/debug-groups", async (_req, res) => {
  try { const data = await getGroups(); res.json(data); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/webhook", async (req, res) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.query.secret !== secret) return res.status(401).send("unauthorized");
  const isGroup = req.body.isgroup === true || req.body.isgroup === "true";
  const groupId = isGroup ? (req.body.sender || req.body.pengirim) : null;
  const from = isGroup ? (req.body.member || req.body.username) : (req.body.sender || req.body.from || req.body.phone);
  const text = req.body.message || req.body.pesan || req.body.text || req.body.body;
  res.status(200).send("ok");
  if (!from || !text) { console.warn("[webhook] missing sender/message", req.body); return; }
  if (isGroup) {
    const tagged = text.includes(`@${BOT_NUMBER}`) || text.includes(`@${BOT_LID}`);
    if (!tagged) { console.log(`[webhook] not tagged, ignoring`); return; }
  }
  const replyTarget = groupId || from;
  try {
    const answer = await reply(from, text);
    await sendMessage(replyTarget, answer);
  } catch (err) { console.error("[webhook] error:", err.message); }
});

app.listen(PORT, () => {
  console.log(`BillyAI listening on :${PORT}`);
  startReminders();
  // Auto-sync WhatsApp groups with Fonnte on every startup
  getGroups()
    .then(data => console.log(`[startup] synced ${data?.data?.length ?? 0} group(s)`))
    .catch(err => console.warn("[startup] group sync failed:", err.message));
});
