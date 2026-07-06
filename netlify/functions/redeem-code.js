// netlify/functions/redeem-code.js
// Tukeurkeun kode premium jadi status premium permanén keur akun (email) anu nyoba.
// Request: POST { email, code }
// Response: { success: true } atawa { success: false, error }

const { redeemCode } = require('./quota');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { email, code } = payload;
  if (!email || !code) {
    return { statusCode: 400, body: JSON.stringify({ error: 'email jeung code wajib dieusian' }) };
  }

  try {
    const result = await redeemCode(email, code);
    return {
      statusCode: result.success ? 200 : 400,
      body: JSON.stringify(result),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Aya kasalahan di server' }) };
  }
};
