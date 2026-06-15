import "dotenv/config";
import express from "express";
import { reply } from "./billy.js";
import { sendMessage, getGroups } from "./fonnte.js";
import { startReminders } from "./reminders.js";
import { maybeSummarize } from "./summarizer.js";
import { saveMessage, getDueReminders, markReminderSent } from "./db.js";
import cron from "node-cron";

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
  const senderName = req.body.name || req.body.pushname || from;
  const text = req.body.message || req.body.pesan || req.body.text || req.body.body;
  res.status(200).send("ok");
  if (!from || !text) { console.warn("[webhook] missing sender/message", req.body); return; }

  // Save ALL group messages to Supabase for context memory
  if (isGroup && groupId) {
    saveMessage({ groupId, sender: from, senderName, message: text })
      .then(() => maybeSummarize(groupId))
      .catch(err => console.warn("[db] failed to save message:", err.message));
  }

  if (isGroup) {
    const tagged = text.includes(`@${BOT_NUMBER}`) || text.includes(`@${BOT_LID}`);
    if (!tagged) { console.log(`[webhook] not tagged, ignoring`); return; }
  }
  const replyTarget = groupId || from;
  try {
    const answer = await reply(from, text, groupId);
    await sendMessage(replyTarget, answer);
  } catch (err) { console.error("[webhook] error:", err.message); }
});

// Check for due dynamic reminders every minute
cron.schedule("* * * * *", async () => {
  try {
    const due = await getDueReminders();
    for (const reminder of due) {
      await sendMessage(reminder.target, reminder.message);
      await markReminderSent(reminder.id);
      console.log(`[reminder] sent to ${reminder.target}: ${reminder.message}`);
    }
  } catch (err) {
    console.error("[reminder] check failed:", err.message);
  }
}, { timezone: "Asia/Jakarta" });

app.listen(PORT, () => {
  console.log(`BillyAI listening on :${PORT}`);
  startReminders();
  // Auto-sync WhatsApp groups with Fonnte on every startup
  getGroups()
    .then(data => console.log(`[startup] synced ${data?.data?.length ?? 0} group(s)`))
    .catch(err => console.warn("[startup] group sync failed:", err.message));
});
