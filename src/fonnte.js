import axios from "axios";

const FONNTE_SEND_URL = "https://api.fonnte.com/send";

/**
 * Send a WhatsApp message through Fonnte.
 * @param {string} target - recipient number or group ID
 * @param {string} message - text to send
 * @returns {Promise<object>} Fonnte API response data
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
