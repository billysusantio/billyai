import "dotenv/config";
import express from "express";
import { reply } from "./billy.js";
import { sendMessage } from "./fonnte.js";
import { startReminders } from "./reminders.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Fonnte posts form-encoded

const PORT = process.env.PORT || 3000;

// Health check (Railway uses this to confirm the service is up).
app.get("/", (_req, res) => res.send("BillyAI is awake 🤖"));

// Inbound WhatsApp messages from Fonnte land here.
// Configure this URL as your device webhook in the Fonnte dashboard.
app.post("/webhook", async (req, res) => {
  // Optional shared-secret check
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.query.secret !== secret) {
    return res.status(401).send("unauthorized");
  }

  // Fonnte payload fields: sender (number), message (text). Field names can vary
  // by Fonnte version, so we read a few common aliases defensively.
  const sender = req.body.sender || req.body.from || req.body.phone;
  const text = req.body.message || req.body.text || req.body.body;

  // Ack immediately so Fonnte doesn't retry while Claude is thinking.
  res.status(200).send("ok");

  if (!sender || !text) {
    console.warn("[webhook] missing sender/message in payload", req.body);
    return;
  }

  try {
    const answer = await reply(sender, text);
    await sendMessage(sender, answer);
  } catch (err) {
    console.error("[webhook] error handling message:", err.message);
  }
});

app.listen(PORT, () => {
  console.log(`BillyAI listening on :${PORT}`);
  startReminders();
});
