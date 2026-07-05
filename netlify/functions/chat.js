// netlify/functions/chat.js
// Cocok persis dengan frontend Cep Deden AI.
// Request:  { provider, model, systemPrompt, messages: [{role, content, images}], deviceId }
// Response sukses: { text }
// Response kuota habis (429): { error }  -> otomatis muncul di bubble chat sebagai pesan error

const { checkAndIncrement } = require("./quota");

const DAILY_LIMIT_CHAT = 15;

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

  const { provider = "openai", model, systemPrompt, messages, deviceId } = payload;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Field 'messages' wajib diisi" }) };
  }

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
        error: "Kuota ngobrol gratis dinten ieu tos béak, Lur. Yuk upgrade ka premium heula! 🙏",
      }),
    };
  }

  try {
    let text;

    if (provider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY belum di-set");

      const contents = messages.map((m) => {
        const parts = [];
        if (m.content) parts.push({ text: m.content });
        if (m.images && m.images.length) {
          m.images.forEach((dataUrl) => {
            const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
            if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          });
        }
        return { role: m.role === "assistant" ? "model" : "user", parts };
      });

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-2.5-flash"}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          }),
        }
      );
      const raw = await res.text();
      if (!res.ok) throw new Error(`Gemini error: ${raw}`);
      const data = JSON.parse(raw);
      text = data.candidates?.[0]?.content?.parts?.[0]?.text || "(kosong)";
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY belum di-set");

      const finalMessages = [];
      if (systemPrompt) finalMessages.push({ role: "system", content: systemPrompt });

      messages.forEach((m) => {
        if (m.images && m.images.length) {
          const contentParts = [{ type: "text", text: m.content || "" }];
          m.images.forEach((dataUrl) => {
            contentParts.push({ type: "image_url", image_url: { url: dataUrl } });
          });
          finalMessages.push({ role: m.role, content: contentParts });
        } else {
          finalMessages.push({ role: m.role, content: m.content });
        }
      });

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          messages: finalMessages,
          temperature: 0.7,
        }),
      });
      const raw = await res.text();
      if (!res.ok) throw new Error(`OpenAI error: ${raw}`);
      const data = JSON.parse(raw);
      text = data.choices?.[0]?.message?.content || "(kosong)";
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
