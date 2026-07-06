// netlify/functions/check-status.js
// Cek status akun (premium/gratis) & sesa kuota harian, TANPA ngurangan kuota.
// Request: GET /.netlify/functions/check-status?email=xxx@xxx.com
// Response: { isPremium, chatRemaining, imageRemaining, videoRemaining }

const { getStatus } = require('./quota');

exports.handler = async function (event) {
  const email = event.queryStringParameters?.email;

  try {
    const status = await getStatus(email);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(status),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
