import cron from "node-cron";
import { getReminders, resolveTargets } from "./config.js";
import { sendMessage } from "./fonnte.js";

/**
 * Schedule all reminders from config. Each reminder fires on its own cron and
 * is delivered to every member matching its role/team target.
 * Returns the list of scheduled cron tasks (so callers can stop them in tests).
 */
export function startReminders() {
  const tz = process.env.TZ || "Asia/Jakarta";
  const reminders = getReminders();
  const tasks = [];

  for (const r of reminders) {
    if (!cron.validate(r.cron)) {
      console.error(`[reminders] invalid cron "${r.cron}" for ${r.id}, skipping`);
      continue;
    }
    const task = cron.schedule(
      r.cron,
      () => fire(r),
      { timezone: tz }
    );
    tasks.push(task);
    console.log(`[reminders] scheduled ${r.id} @ "${r.cron}" (${tz})`);
  }

  console.log(`[reminders] ${tasks.length} reminder(s) active`);
  return tasks;
}

async function fire(reminder) {
  const targets = resolveTargets(reminder.target || {});
  console.log(`[reminders] firing ${reminder.id} -> ${targets.length} recipient(s)`);
  for (const m of targets) {
    try {
      await sendMessage(m.phone, reminder.message);
    } catch (err) {
      console.error(`[reminders] failed to send ${reminder.id} to ${m.name}:`, err.message);
    }
  }
}
