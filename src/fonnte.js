import axios from "axios";

const FONNTE_SEND_URL = "https://api.fonnte.com/send";
const FONNTE_FETCH_GROUP_URL = "https://api.fonnte.com/fetch-group";
const FONNTE_GET_GROUP_URL = "https://api.fonnte.com/get-whatsapp-group";

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
 * Sync group list from WhatsApp, then return the group list.
 * Call fetch-group first (updates the list), then get-whatsapp-group.
 */
export async function getGroups() {
        const token = process.env.FONNTE_TOKEN;
        if (!token) throw new Error("FONNTE_TOKEN is not set");

  // Step 1: sync groups from WhatsApp
  await axios.post(FONNTE_FETCH_GROUP_URL, {}, { headers: { Authorization: token } });

  // Step 2: retrieve the synced group list
  const res = await axios.post(FONNTE_GET_GROUP_URL, {}, { headers: { Authorization: token } });
        console.log(`[fonnte] groups:`, JSON.stringify(res.data));
        return res.data;
}
