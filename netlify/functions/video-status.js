// netlify/functions/video-status.js
// Cocok persis dengan frontend Cep Deden AI.
// Request:  GET /.netlify/functions/video-status?op=xxxx
// Response: { done, video (url, kalau udah selesai) }

exports.handler = async function (event) {
  const op = event.queryStringParameters?.op;

  if (!op) {
    return { statusCode: 400, body: JSON.stringify({ error: "Query param 'op' wajib diisi" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY belum di-set" }) };
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${op}?key=${apiKey}`);
    const raw = await res.text();
    if (!res.ok) throw new Error(`Veo error: ${raw}`);
    const data = JSON.parse(raw);

    const rawVideoUrl = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri || null;
    // URL video dari Google butuh API key nempel biar bisa diakses langsung dari browser
    const video = rawVideoUrl ? `${rawVideoUrl}${rawVideoUrl.includes("?") ? "&" : "?"}key=${apiKey}` : null;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !!data.done, video }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
