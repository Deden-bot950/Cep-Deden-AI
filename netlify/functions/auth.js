// netlify/functions/auth.js
// Handles user registration, login, and admin listing of registered users.
// Users are stored in a shared JSONBin bin (JSONBIN_USERS_BIN_ID), with
// passwords hashed using Node's built-in scrypt (never stored in plain text).
//
// Required environment variables:
//   JSONBIN_API_KEY      - JSONBin X-Master-Key
//   JSONBIN_USERS_BIN_ID - ID of a JSONBin bin pre-created with content: {"users":[]}
//   ADMIN_PANEL_PASSWORD - password Deden uses to view the registered users list

const crypto = require('crypto');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
  const JSONBIN_USERS_BIN_ID = process.env.JSONBIN_USERS_BIN_ID;
  const ADMIN_PANEL_PASSWORD = process.env.ADMIN_PANEL_PASSWORD;

  if (!JSONBIN_API_KEY || !JSONBIN_USERS_BIN_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'JSONBIN_API_KEY atawa JSONBIN_USERS_BIN_ID can diatur di Netlify' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { action, name, email, password, adminPassword } = payload;

  try {
    if (action === 'register') {
      return await register(JSONBIN_API_KEY, JSONBIN_USERS_BIN_ID, name, email, password);
    } else if (action === 'login') {
      return await login(JSONBIN_API_KEY, JSONBIN_USERS_BIN_ID, email, password);
    } else if (action === 'list') {
      return await list(JSONBIN_API_KEY, JSONBIN_USERS_BIN_ID, ADMIN_PANEL_PASSWORD, adminPassword);
    }
    return { statusCode: 400, body: JSON.stringify({ error: "action kudu 'register', 'login', atawa 'list'" }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Aya kasalahan di server' }) };
  }
};

async function fetchUsers(apiKey, binId) {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: { 'X-Master-Key': apiKey },
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Gagal muka database pamaké');
  return (data.record && data.record.users) || [];
}

async function saveUsers(apiKey, binId, users) {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
    body: JSON.stringify({ users }),
  });
  if (!res.ok) throw new Error('Gagal nyimpen database pamaké');
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

async function register(apiKey, binId, name, email, password) {
  if (!name || !email || !password) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ngaran, email, jeung kecap sandi wajib dieusian' }) };
  }
  if (password.length < 6) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Kecap sandi minimal 6 karakter' }) };
  }

  const emailNorm = email.trim().toLowerCase();
  const users = await fetchUsers(apiKey, binId);

  if (users.find((u) => u.email === emailNorm)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email ieu geus kadaptar, cobian asup wungkul' }) };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);

  users.push({ name: name.trim(), email: emailNorm, salt, hash, createdAt: Date.now() });
  await saveUsers(apiKey, binId, users);

  return { statusCode: 200, body: JSON.stringify({ success: true, user: { name: name.trim(), email: emailNorm } }) };
}

async function login(apiKey, binId, email, password) {
  if (!email || !password) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email jeung kecap sandi wajib dieusian' }) };
  }
  const emailNorm = email.trim().toLowerCase();
  const users = await fetchUsers(apiKey, binId);
  const user = users.find((u) => u.email === emailNorm);

  if (!user) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email teu kapanggih, cobian daptar heula' }) };
  }

  const hash = hashPassword(password, user.salt);
  const hashBuf = Buffer.from(hash, 'hex');
  const storedBuf = Buffer.from(user.hash, 'hex');

  const match = hashBuf.length === storedBuf.length && crypto.timingSafeEqual(hashBuf, storedBuf);
  if (!match) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Kecap sandi salah' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true, user: { name: user.name, email: user.email } }) };
}

async function list(apiKey, binId, adminPasswordEnv, adminPasswordInput) {
  if (!adminPasswordEnv || adminPasswordInput !== adminPasswordEnv) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Kecap sandi admin salah' }) };
  }
  const users = await fetchUsers(apiKey, binId);
  const safeList = users
    .map((u) => ({ name: u.name, email: u.email, createdAt: u.createdAt }))
    .sort((a, b) => b.createdAt - a.createdAt);

  return { statusCode: 200, body: JSON.stringify({ success: true, users: safeList }) };
}
