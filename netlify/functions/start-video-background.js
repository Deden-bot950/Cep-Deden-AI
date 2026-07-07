// netlify/functions/start-video-background.js
// BACKGROUND FUNCTION (nami file kudu aya "-background", ieu aturan Netlify).
// Netlify langsung ngabales 202 ka nu manggil tanpa nunggu, sarta fungsi ieu
// terus lumangsung di latar tukang nepi ka 15 menit — cukup keur nungguan
// Veo ngajieun video, nu bisa leuwih lila ti 10 detik.
//
// Body: { prompt, referenceImage?, aspectRatio?, email, jobId }
// Hasilna disimpen di JSONBin ngaliwatan jobs.js, dicek ku video-job-status.js

const { checkAndIncrement } = require('./quota');
const { setJob } = require('./jobs');

exports.handler = async function (event) {
  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: '' };
  }

  const { prompt, referenceImage, aspectRatio, email, jobId } = payload;
  if (!jobId) return { statusCode: 400, body: '' };

  try {
    if (!prompt) {
      await setJob(jobId, { status: 'error', error: 'Prompt wajib diisi' });
      return { statusCode: 200, body: '' };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await setJob(jobId, { status: 'error', error: 'GEMINI_API_KEY belum diset' });
      return { statusCode: 200, body: '' };
    }

    const quota = await checkAndIncrement(email, 'video');
    if (!quota.allowed) {
      await setJob(jobId, { status: 'error', error: `Wates ${quota.limit} video/poé geus kapaké sadayana. Cobian deui isuk, nya.` });
      return { statusCode: 200, body: '' };
    }

    await setJob(jobId, { status: 'processing' });

    const instance = { prompt };
    if (referenceImage) {
      const match = referenceImage.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        instance.image = { mimeType: match[1], bytesBase64Encoded: match[2] };
      }
    }

    const body = { instances: [instance] };
    if (aspectRatio) body.parameters = { aspectRatio };

    // 1. Mimitian job Veo
    const startRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      }
    );
    const startData = await startRes.json();
    if (!startRes.ok) {
      await setJob(jobId, { status: 'error', error: startData.error?.message || 'Gagal mimitian video Veo' });
      return { statusCode: 200, body: '' };
    }

    const opName = startData.name;

    // 2. Polling status internal (nepi ka 12 menit, di jero fungsi background ieu wungkul)
    let done = false;
    let tries = 0;
    let finalData = null;
    while (!done && tries < 72) { // 72 x 10s = 12 menit
      await new Promise((r) => setTimeout(r, 10000));
      const statusRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${opName}`, {
        headers: { 'x-goog-api-key': apiKey },
      });
      const statusData = await statusRes.json();
      if (!statusRes.ok) {
        await setJob(jobId, { status: 'error', error: statusData.error?.message || 'Gagal mariksa status video' });
        return { statusCode: 200, body: '' };
      }
      if (statusData.done) {
        done = true;
        finalData = statusData;
      }
      tries++;
    }

    if (!done) {
      await setJob(jobId, { status: 'error', error: 'Video teuing lila dijieun (leuwih 12 menit), cobian deui' });
      return { statusCode: 200, body: '' };
    }

    if (finalData.error) {
      await setJob(jobId, { status: 'error', error: finalData.error.message || 'Video generation gagal' });
      return { statusCode: 200, body: '' };
    }

    const sample = finalData.response?.generateVideoResponse?.generatedSamples?.[0];
    const videoUri = sample?.video?.uri;
    if (!videoUri) {
      await setJob(jobId, { status: 'error', error: 'Video selesai tapi URI teu kapanggih' });
      return { statusCode: 200, body: '' };
    }

    // 3. Unduh video jeung simpen jadi base64
    const videoRes = await fetch(videoUri, { headers: { 'x-goog-api-key': apiKey } });
    if (!videoRes.ok) {
      await setJob(jobId, { status: 'error', error: 'Gagal ngundeur video ti Google' });
      return { statusCode: 200, body: '' };
    }
    const arrayBuffer = await videoRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    await setJob(jobId, { status: 'done', video: `data:video/mp4;base64,${base64}` });
    return { statusCode: 200, body: '' };
  } catch (err) {
    try { await setJob(jobId, { status: 'error', error: err.message || 'Aya kasalahan teu kaduga' }); } catch (e2) {}
    return { statusCode: 200, body: '' };
  }
};
