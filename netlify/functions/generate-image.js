// netlify/functions/generate-image.js
// Cocok persis dengan frontend Cep Deden AI. Pakai Gemini (nano banana) - bisa generate baru & edit foto.
// Request:  { prompt, referenceImage (data URL, opsional), deviceId }
// Response sukses: { image (data URL) }
// Response kuota habis (429): { error }

const { checkAndIncrement } = require("./lib/quota");

const DAILY_LIMIT_IMAGE = 3;

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

  let quota;
  try {
    quota = await checkAndIncrement(deviceId, "imageCount", DAILY_LIMIT_IMAGE);
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: `Quota error: ${err.message}` }) };
  }

  if (!quota.allowed) {
    return {
      statusCode: 429,
      body: JSON.stringify({
        error: "Kuota gambar gratis dinten ieu tos béak, Lur. Yuk upgrade ka premium heula! 🙏",
      }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY belum di-set" }) };
  }

  try {
    const parts = [];
    if (referenceImage) {
      const match = referenceImage.match(/^data:(.+?);base64,(.+)$/);
      if (match) {
        parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }
    parts.push({ text: prompt });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
      }
    );
    const raw = await res.text();
    if (!res.ok) throw new Error(`Gemini error: ${raw}`);
    const data = JSON.parse(raw);
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new Error("Gemini teu mulangkeun gambar");

    const image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
