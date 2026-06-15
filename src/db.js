import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Save a message from the group to Supabase
export async function saveMessage({ groupId, sender, senderName, message }) {
  const { error } = await supabase.from("messages").insert({
    group_id: groupId,
    sender,
    sender_name: senderName,
    message,
  });
  if (error) console.error("[db] saveMessage error:", error.message);
}

// Get last N messages from a group (for context injection)
export async function getRecentMessages(groupId, limit = 30) {
  const { data, error } = await supabase
    .from("messages")
    .select("sender_name, message, timestamp")
    .eq("group_id", groupId)
    .order("timestamp", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[db] getRecentMessages error:", error.message);
    return [];
  }
  // Reverse so oldest is first (chronological order)
  return (data || []).reverse();
}

// Save a dynamic reminder
export async function saveReminder({ target, message, fireAt }) {
  const { error } = await supabase.from("reminders").insert({
    target,
    message,
    fire_at: fireAt,
    sent: false,
  });
  if (error) console.error("[db] saveReminder error:", error.message);
}

// Get all pending reminders that are due
export async function getDueReminders() {
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("sent", false)
    .lte("fire_at", new Date().toISOString());
  if (error) {
    console.error("[db] getDueReminders error:", error.message);
    return [];
  }
  return data || [];
}

// Mark a reminder as sent
export async function markReminderSent(id) {
  const { error } = await supabase
    .from("reminders")
    .update({ sent: true })
    .eq("id", id);
  if (error) console.error("[db] markReminderSent error:", error.message);
}
