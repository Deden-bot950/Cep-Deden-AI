// netlify/functions/video-status.js
// Cek status render video Veo (dipanggil berkala/polling oleh frontend).
// Query param: ?operationName=xxxx
// Balikan: { done: bool, videoUrl: "https://..." (kalau sudah selesai) }

exports.handler = async function (event) {
  const operationName = event.queryStringParameters?.operationName;

  if (!operationName) {
    return { statusCode: 400, body: JSON.stringify({ error: "Query param 'operationName' wajib diisi" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY belum di-set" }) };
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
    );
    const raw = await res.text();
    if (!res.ok) throw new Error(`Veo error: ${raw}`);
    const data = JSON.parse(raw);

    const videoUrl = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri || null;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !!data.done, videoUrl }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
