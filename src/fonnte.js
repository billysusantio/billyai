mport axios from "axios";

const FONNTE_SEND_URL = "https://api.fonnte.com/send";
const FONNTE_GROUPS_URL = "https://api.fonnte.com/get-groups";

/**
 * Send a WhatsApp message through Fonnte.
 */
export async function sendMessage(target, message) {
      const token = process.env.FONNTE_TOKEN;
      if (!token) throw new Error("FONNTE_TOKEN is not set");

  console.log(`[fonnte] sending to ${target}`);

  const res = await axios.post(
          FONNTE_SEND_URL,
      { target, message },
      { headers: { Authorization: token } }
        );

  console.log(`[fonnte] response:`, JSON.stringify(res.data));
      return res.data;
}

/**
 * Fetch all groups for this device from Fonnte.
 * Returns array of { id, name, ... }
 */
export async function getGroups() {
      const token = process.env.FONNTE_TOKEN;
      if (!token) throw new Error("FONNTE_TOKEN is not set");

  const res = await axios.post(
          FONNTE_GROUPS_URL,
      {},
      { headers: { Authorization: token } }
        );

  console.log(`[fonnte] groups:`, JSON.stringify(res.data));
      return res.data;
}
