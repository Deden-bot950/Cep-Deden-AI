// netlify/functions/quota.js
// Checks and increments daily usage quota per logged-in user (by email).
// Reuses the same JSONBin "users" bin as auth.js, adding a `usage` field per user.
//
// Limits: chat = 25 pesen/poé, video = 2 kali/poé
//
// Required environment variables (same as auth.js):
//   JSONBIN_API_KEY
//   JSONBIN_USERS_BIN_ID

const LIMITS = { chat: 25, video: 2 };

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
  const JSONBIN_USERS_BIN_ID = process.env.JSONBIN_USERS_BIN_ID;

  if (!JSONBIN_API_KEY || !JSONBIN_USERS_BIN_ID) {
    return { statusCode: 500, body: JSON.stringify({ error: 'JSONBIN_API_KEY atawa JSONBIN_USERS_BIN_ID can diatur' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { email, type } = payload;
  if (!email || !LIMITS[type]) {
    return { statusCode: 400, body: JSON.stringify({ error: "email jeung type ('chat' atawa 'video') wajib dieusian" }) };
  }

  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_USERS_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_API_KEY },
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Gagal muka database pamaké');

    const users = (data.record && data.record.users) || [];
    const emailNorm = email.trim().toLowerCase();
    const user = users.find((u) => u.email === emailNorm);
    if (!user) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Akun teu kapanggih' }) };
    }

    const today = new Date().toISOString().slice(0, 10);
    if (!user.usage || user.usage.date !== today) {
      user.usage = { date: today, chat: 0, video: 0 };
    }

    const limit = LIMITS[type];
    const used = user.usage[type] || 0;

    if (used >= limit) {
      return { statusCode: 200, body: JSON.stringify({ allowed: false, remaining: 0, limit }) };
    }

    user.usage[type] = used + 1;

    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_USERS_BIN_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
      body: JSON.stringify({ users }),
    });

    return { statusCode: 200, body: JSON.stringify({ allowed: true, remaining: limit - user.usage[type], limit }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Aya kasalahan di server' }) };
  }
};
