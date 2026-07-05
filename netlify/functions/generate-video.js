// netlify/functions/generate-video.js
// Cocok persis dengan frontend Cep Deden AI. Pakai Veo 3.1 (Gemini) - KHUSUS premium.
// Request:  { prompt, referenceImage (data URL, opsional untuk image-to-video), deviceId }
// Response sukses: { operationName }
// Response ditolak (403): { error }

const { isPremiumUser } = require("./quota");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Body bukan JSON valid" }) };
  }

  const { prompt, referenceImage, deviceId } = payload;

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
        error: "Fitur video khusus member premium, Lur. Yuk upgrade heula! 🎬",
      }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY belum di-set" }) };
  }

  try {
    const instance = { prompt };
    if (referenceImage) {
      const match = referenceImage.match(/^data:(.+?);base64,(.+)$/);
      if (match) {
        instance.image = { mimeType: match[1], bytesBase64Encoded: match[2] };
      }
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instances: [instance] }),
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
