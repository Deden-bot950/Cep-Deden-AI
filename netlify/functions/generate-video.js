// netlify/functions/generate-video.js
// Starts a Veo 3.1 video generation job. Returns an operation name to poll.
// Body: { prompt, referenceImage?, aspectRatio?, email }

const { checkAndIncrementFast } = require('./quota');

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY belum diset" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { prompt, referenceImage, aspectRatio, email } = payload;
  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ error: "prompt wajib diisi" }) };
  }

  try {
    const quota = await checkAndIncrementFast(email, 'video');
    if (!quota.allowed) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: `Wates ${quota.limit} video/poé geus kapaké sadayana. Cobian deui isuk, nya.` }),
      };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Gagal mariksa kuota' }) };
  }

  const instance = { prompt };
  if (referenceImage) {
    const match = referenceImage.match(/^data:(.+);base64,(.+)$/);
    if (match) {
      instance.image = { mimeType: match[1], bytesBase64Encoded: match[2] };
    }
  }

  const body = { instances: [instance] };
  if (aspectRatio) {
    body.parameters = { aspectRatio };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8800);

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      throw new Error("Google ngabales format anu teu jelas, cobian deui sakedap deui");
    }

    if (!res.ok) {
      throw new Error(data.error?.message || "Gemini video API error");
    }

    return { statusCode: 200, body: JSON.stringify({ operationName: data.name }) };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { statusCode: 504, body: JSON.stringify({ error: "Server Google lila teuing ngabales, cobian deui sakedap deui nya, Lur" }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Gagal memulai generate video" }) };
  }
};
