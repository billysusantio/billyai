import "dotenv/config";
import express from "express";
import { reply } from "./billy.js";
import { sendMessage, getGroups } from "./fonnte.js";
import { startReminders } from "./reminders.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Fonnte posts form-encoded

const PORT = process.env.PORT || 3000;
const BOT_NUMBER = process.env.BOT_NUMBER || "6287811808680";
const BOT_LID = process.env.BOT_LID || "224146457903221"; // WhatsApp internal LID for this device

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

           const isGroup = req.body.isgroup === true || req.body.isgroup === "true";

           // In group messages: sender = group ID, member = actual person who sent
           // In DMs: sender = the person's number
           const rawGroupId = isGroup ? (req.body.sender || req.body.pengirim) : null;
        // Fonnte rejects group IDs with @g.us suffix — strip it
           const groupId = rawGroupId ? rawGroupId.replace(/@g\.us$/i, "") : null;

           const from = isGroup
          ? (req.body.member || req.body.username)
                     : (req.body.sender || req.body.from || req.body.phone);

           const text = req.body.message || req.body.pesan || req.body.text || req.body.body;

           // Ack immediately so Fonnte doesn't retry while Gemini is thinking.
           res.status(200).send("ok");

           if (!from || !text) {
                     console.warn("[webhook] missing sender/message in payload", req.body);
                     return;
           }

           // If message is from a group, only reply when Bilbot is tagged.
           // Fonnte encodes tags using WhatsApp's internal LID, not the phone number.
           if (isGroup) {
                     const tagged =
                                 text.includes(`@${BOT_NUMBER}`) || text.includes(`@${BOT_LID}`);
                     if (!tagged) {
                                 console.log(`[webhook] group msg from ${from} in ${groupId} — not tagged, ignoring`);
                                 return;
                     }
                     console.log(`[webhook] group msg from ${from} in ${groupId} — tagged! replying`);
           }

           // For group messages reply to the group; for DMs reply to the sender.
           const replyTarget = groupId || from;

           try {
                     const answer = await reply(from, text);
                     await sendMessage(replyTarget, answer);
           } catch (err) {
                     console.error("[webhook] error handling message:", err.message);
           }
});

app.listen(PORT, () => {
        console.log(`BillyAI listening on :${PORT}`);
        startReminders();
});
