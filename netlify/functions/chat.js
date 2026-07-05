// netlify/functions/chat.js
// Chat pakai OpenAI atau Gemini, dengan limit 15 chat/hari untuk user gratis.
// Body: { deviceId, messages: [{role, content}], system: "opsional", provider: "openai"|"gemini" }
// Balikan sukses: { reply, remaining, isPremium }
// Balikan kuota habis (429): { error, quotaExceeded: true }

const { checkAndIncrement } = require("./lib/quota");

const DAILY_LIMIT_CHAT = 15;

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

  const { deviceId, messages, system, provider = "openai" } = payload;

  if (!deviceId) {
    return { statusCode: 400, body: JSON.stringify({ error: "deviceId wajib diisi" }) };
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Field 'messages' wajib diisi" }) };
  }

  // Cek & potong kuota dulu sebelum panggil AI (biar nggak nombok biaya kalau ditolak)
  let quota;
  try {
    quota = await checkAndIncrement(deviceId, "chatCount", DAILY_LIMIT_CHAT);
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: `Quota error: ${err.message}` }) };
  }

  if (!quota.allowed) {
    return {
      statusCode: 429,
      body: JSON.stringify({
        error: "Kuota chat gratis harian kamu udah habis. Upgrade ke premium biar unlimited!",
        quotaExceeded: true,
      }),
    };
  }

  try {
    let reply;

    if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY belum di-set");

      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          }),
        }
      );
      const raw = await res.text();
      if (!res.ok) throw new Error(`Gemini error: ${raw}`);
      const data = JSON.parse(raw);
      reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "(kosong)";
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY belum di-set");

      const finalMessages = [];
      if (system) finalMessages.push({ role: "system", content: system });
      finalMessages.push(...messages);

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: finalMessages,
          temperature: 0.7,
        }),
      });
      const raw = await res.text();
      if (!res.ok) throw new Error(`OpenAI error: ${raw}`);
      const data = JSON.parse(raw);
      reply = data.choices?.[0]?.message?.content || "(kosong)";
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply, remaining: quota.remaining, isPremium: quota.isPremium }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
