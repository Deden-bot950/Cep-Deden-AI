// netlify/functions/jobs.js
// Modul biasa (require("./jobs")), keur nyimpen status job video anu diprosés
// di latar tukang (background function), sabab prosés Veo bisa leuwih lila
// ti wates 10 detik fungsi Netlify biasa.
//
// Required environment variables:
//   JSONBIN_API_KEY
//   JSONBIN_JOBS_BIN_ID (bin anyar, misah ti bin akun pamaké, eusi awal: {"jobs":{}})

async function fetchJobs() {
  const apiKey = process.env.JSONBIN_API_KEY;
  const binId = process.env.JSONBIN_JOBS_BIN_ID;
  if (!apiKey || !binId) throw new Error('JSONBIN_API_KEY atawa JSONBIN_JOBS_BIN_ID can diatur');

  const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: { 'X-Master-Key': apiKey },
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Gagal muka database job video');
  return (data.record && data.record.jobs) || {};
}

async function saveJobs(jobs) {
  const apiKey = process.env.JSONBIN_API_KEY;
  const binId = process.env.JSONBIN_JOBS_BIN_ID;
  await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
    body: JSON.stringify({ jobs }),
  });
}

async function setJob(jobId, data) {
  const jobs = await fetchJobs();
  jobs[jobId] = { ...data, updatedAt: Date.now() };
  // Beresihan job anu leuwih heubeul ti 2 jam sangkan bin teu beuki gedé
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const key of Object.keys(jobs)) {
    if (jobs[key].updatedAt < cutoff) delete jobs[key];
  }
  await saveJobs(jobs);
}

async function getJob(jobId) {
  const jobs = await fetchJobs();
  return jobs[jobId] || null;
}

module.exports = { setJob, getJob };
