// netlify/functions/video-job-status.js
// Fungsi biasa (cepet), dipaké frontend keur mariksa status job video
// anu diproses ku start-video-background.js.
// Query: ?jobId=xxx
// Response: { status: 'processing'|'done'|'error', video?, error? }

const { getJob } = require('./jobs');

exports.handler = async function (event) {
  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'jobId wajib diisi' }) };
  }

  try {
    const job = await getJob(jobId);
    if (!job) {
      return { statusCode: 200, body: JSON.stringify({ status: 'processing' }) };
    }
    return { statusCode: 200, body: JSON.stringify(job) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Gagal mariksa status job' }) };
  }
};
