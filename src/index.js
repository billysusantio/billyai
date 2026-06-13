import "dotenv/config";
import express from "express";
import { reply } from "./billy.js";
import { sendMessage } from "./fonnte.js";
import { startReminders } from "./reminders.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Fonnte posts form-encoded

const PORT = process.env.PORT || 3000;
const BOT_NUMBER = process.env.BOT_NUMBER || "6287811808680";

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

           // Fonnte payload fields
           const sender = req.body.sender || req.body.from || req.body.phone;
    const text = req.body.message || req.body.text || req.body.body;
    const group = req.body.group || req.body.groupid || req.body.group_id || null;

           // Ack immediately so Fonnte doesn't retry while Gemini is thinking.
           res.status(200).send("ok");

           if (!sender || !text) {
                 console.warn("[webhook] missing sender/message in payload", req.body);
                 return;
           }

           // If message is from a group, only reply when Bilbot is tagged by number.
           // WhatsApp encodes tags as @<number> regardless of saved contact name.
           if (group) {
                 const tagged = text.includes(`@${BOT_NUMBER}`);
                 if (!tagged) {
                         console.log(`[webhook] group msg from ${sender} in ${group} — not tagged, ignoring`);
                         return;
                 }
                 console.log(`[webhook] group msg from ${sender} in ${group} — tagged! replying`);
           }

           // For group messages, reply to the group; for DMs, reply to the sender.
           const replyTarget = group || sender;

           try {
                 const answer = await reply(sender, text);
                 await sendMessage(replyTarget, answer);
           } catch (err) {
                 console.error("[webhook] error handling message:", err.message);
           }
});

app.listen(PORT, () => {
    console.log(`BillyAI listening on :${PORT}`);
    startReminders();
});
