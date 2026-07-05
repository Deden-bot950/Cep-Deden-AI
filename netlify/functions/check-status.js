// netlify/functions/check-status.js
// Cek status akun (premium/gratis) & sisa kuota harian, TANPA mengurangi kuota.
// Request: GET /.netlify/functions/check-status?deviceId=xxxx
// Response: { isPremium, chatRemaining, imageRemaining }

const { getStatus } = require("./quota");

exports.handler = async function (event) {
  const deviceId = event.queryStringParameters?.deviceId;

  try {
    const status = await getStatus(deviceId);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(status),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
