import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configDir = join(__dirname, "..", "config");

// Load a config file, falling back to its .example.json sibling so the app
// still boots before Billy's real backend data is wired in.
function load(name) {
  const real = join(configDir, `${name}.json`);
  const example = join(configDir, `${name}.example.json`);
  const path = existsSync(real) ? real : example;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function getMembers() {
  return load("teams").members ?? [];
}

export function getReminders() {
  return load("reminders").reminders ?? [];
}

// Find a member by their WhatsApp number (Fonnte sends sender as the raw number).
export function findMemberByPhone(phone) {
  const normalized = String(phone).replace(/\D/g, "");
  return getMembers().find((m) => String(m.phone).replace(/\D/g, "") === normalized);
}

// Resolve which members a reminder targets, by role and/or team.
export function resolveTargets({ roles = [], teams = [] }) {
  const members = getMembers();
  if ((!roles || roles.length === 0) && (!teams || teams.length === 0)) {
    return members; // everyone
  }
  return members.filter(
    (m) =>
      (roles.length > 0 && roles.includes(m.role)) ||
      (teams.length > 0 && teams.includes(m.team))
  );
}
