// netlify/functions/generate-image.js
// Generate gambar baru ATAU edit foto yang di-upload, pakai OpenAI atau Gemini.
// Limit 3 gambar/hari untuk user gratis.
//
// Body: {
//   deviceId,
//   prompt,
//   provider: "openai"|"gemini",
//   imageBase64: "opsional - base64 foto yang mau diedit (tanpa prefix data:...)",
//   mimeType: "opsional - contoh image/jpeg, wajib diisi kalau imageBase64 ada"
// }
// Balikan sukses: { imageUrl (data URL base64), remaining, isPremium }

const { checkAndIncrement } = require("./lib/quota");

const DAILY_LIMIT_IMAGE = 3;

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

  const { deviceId, prompt, provider = "openai", imageBase64, mimeType } = payload;

  if (!deviceId) {
    return { statusCode: 400, body: JSON.stringify({ error: "deviceId wajib diisi" }) };
  }
  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ error: "Field 'prompt' wajib diisi" }) };
  }
  if (imageBase64 && !mimeType) {
    return { statusCode: 400, body: JSON.stringify({ error: "mimeType wajib diisi kalau imageBase64 dikirim" }) };
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
        error: "Kuota gambar gratis harian kamu udah habis. Upgrade ke premium biar unlimited!",
        quotaExceeded: true,
      }),
    };
  }

  const isEdit = !!imageBase64;

  try {
    let imageUrl;

    if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY belum di-set");

      // Nano Banana (gemini-2.5-flash-image) bisa generate ATAU edit,
      // tinggal disertakan gambar input sebagai part tambahan kalau ini mode edit.
      const parts = [];
      if (isEdit) {
        parts.push({ inlineData: { mimeType, data: imageBase64 } });
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
      if (!part) throw new Error("Gemini tidak mengembalikan gambar");
      imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY belum di-set");

      if (isEdit) {
        // OpenAI images/edits pakai multipart/form-data, bukan JSON biasa
        const form = new FormData();
        form.append("model", "gpt-image-1");
        form.append("prompt", prompt);
        const buffer = Buffer.from(imageBase64, "base64");
        form.append("image", new Blob([buffer], { type: mimeType }), "input.png");

        const res = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        });
        const raw = await res.text();
        if (!res.ok) throw new Error(`OpenAI error: ${raw}`);
        const data = JSON.parse(raw);
        const b64 = data.data?.[0]?.b64_json;
        if (!b64) throw new Error("OpenAI tidak mengembalikan gambar");
        imageUrl = `data:image/png;base64,${b64}`;
      } else {
        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt,
            size: "1024x1024",
          }),
        });
        const raw = await res.text();
        if (!res.ok) throw new Error(`OpenAI error: ${raw}`);
        const data = JSON.parse(raw);
        const b64 = data.data?.[0]?.b64_json;
        if (!b64) throw new Error("OpenAI tidak mengembalikan gambar");
        imageUrl = `data:image/png;base64,${b64}`;
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, remaining: quota.remaining, isPremium: quota.isPremium }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
