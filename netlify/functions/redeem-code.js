// netlify/functions/redeem-code.js
// User masukin kode premium, kalau cocok sama PREMIUM_CODE (di Netlify env var), langsung jadi premium.
// Request: POST { deviceId, code }
// Response sukses: { success: true }
// Response gagal (400): { error }

const { setPremium } = require("./quota");

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

  const { deviceId, code } = payload;

  if (!deviceId || !code) {
    return { statusCode: 400, body: JSON.stringify({ error: "deviceId jeung code wajib diisi" }) };
  }

  const validCode = process.env.PREMIUM_CODE;
  if (!validCode) {
    return { statusCode: 500, body: JSON.stringify({ error: "PREMIUM_CODE acan di-set di server" }) };
  }

  if (code.trim().toUpperCase() !== validCode.trim().toUpperCase()) {
    return { statusCode: 400, body: JSON.stringify({ error: "Kodena salah, Lur. Coba pariksa deui." }) };
  }

  try {
    await setPremium(deviceId);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
