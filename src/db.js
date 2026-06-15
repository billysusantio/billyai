import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export async function saveMessage({ groupId, sender, senderName, message }) {
  const { error } = await supabase.from("messages").insert({ group_id: groupId, sender, sender_name: senderName, message });
  if (error) console.error("[db] saveMessage error:", error.message);
}

export async function getRecentMessages(groupId, limit = 100) {
  const { data, error } = await supabase.from("messages").select("sender_name, message, timestamp").eq("group_id", groupId).order("timestamp", { ascending: false }).limit(limit);
  if (error) { console.error("[db] getRecentMessages error:", error.message); return []; }
  return (data || []).reverse();
}

export async function getOldMessages(groupId, skip = 100, limit = 300) {
  const { data: recent } = await supabase.from("messages").select("id").eq("group_id", groupId).order("timestamp", { ascending: false }).limit(skip);
  if (!recent || recent.length < skip) return [];
  const oldestRecentId = recent[recent.length - 1].id;
  const { data, error } = await supabase.from("messages").select("sender_name, message, timestamp").eq("group_id", groupId).lt("id", oldestRecentId).order("timestamp", { ascending: true }).limit(limit);
  if (error) { console.error("[db] getOldMessages error:", error.message); return []; }
  return data || [];
}

export async function getSummary(groupId) {
  const { data, error } = await supabase.from("group_summaries").select("summary, updated_at").eq("group_id", groupId).single();
  if (error) return null;
  return data;
}

export async function saveSummary(groupId, summary) {
  const { error } = await supabase.from("group_summaries").upsert({ group_id: groupId, summary, updated_at: new Date().toISOString() }, { onConflict: "group_id" });
  if (error) console.error("[db] saveSummary error:", error.message);
}

export async function saveReminder({ target, message, fireAt }) {
  const { error } = await supabase.from("reminders").insert({ target, message, fire_at: fireAt, sent: false });
  if (error) console.error("[db] saveReminder error:", error.message);
}

export async function getDueReminders() {
  const { data, error } = await supabase.from("reminders").select("*").eq("sent", false).lte("fire_at", new Date().toISOString());
  if (error) { console.error("[db] getDueReminders error:", error.message); return []; }
  return data || [];
}

export async function markReminderSent(id) {
  const { error } = await supabase.from("reminders").update({ sent: true }).eq("id", id);
  if (error) console.error("[db] markReminderSent error:", error.message);
}
