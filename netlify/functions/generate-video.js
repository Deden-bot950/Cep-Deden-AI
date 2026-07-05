// netlify/functions/generate-video.js
// Generate video pakai Veo 3.1 (Gemini) - KHUSUS user premium.
// Body: { deviceId, prompt }
// Balikan sukses: { operationName } -> cek status di video-status.js
// Balikan ditolak (403): { error, premiumOnly: true }

const { isPremiumUser } = require("./lib/quota");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Body bukan JSON valid" }) };
  }

  const { deviceId, prompt } = payload;

  if (!deviceId) {
    return { statusCode: 400, body: JSON.stringify({ error: "deviceId wajib diisi" }) };
  }
  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ error: "Field 'prompt' wajib diisi" }) };
  }

  let premium;
  try {
    premium = await isPremiumUser(deviceId);
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: `Quota error: ${err.message}` }) };
  }

  if (!premium) {
    return {
      statusCode: 403,
      body: JSON.stringify({
        error: "Fitur video cuma buat member premium. Yuk upgrade dulu!",
        premiumOnly: true,
      }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY belum di-set" }) };
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
        }),
      }
    );
    const raw = await res.text();
    if (!res.ok) throw new Error(`Veo error: ${raw}`);
    const data = JSON.parse(raw);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationName: data.name }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
