// netlify/functions/quota.js
// Modul kuota + premium anu dipaké babarengan ku chat.js, generate-image.js,
// generate-video.js, check-status.js, jeung redeem-code.js.
// PERHATOSAN: ieu MODUL biasa (require("./quota")), LAIN fungsi Netlify HTTP
// nu bisa langsung diaksés ku browser.
//
// Nyimpen data di JSONBin "users" bin anu sarua jeung auth.js, nambahan
// widang `usage` (pamakéan harian) jeung `isPremium` per pamaké.
//
// Required environment variables:
//   JSONBIN_API_KEY
//   JSONBIN_USERS_BIN_ID
//   PREMIUM_CODE (kode rahasia keur redeem status premium)

const LIMITS = { chat: 25, image: 10, video: 2 };
const PREMIUM_LIMITS = { chat: 200, image: 50, video: 10 };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchUsers() {
  const apiKey = process.env.JSONBIN_API_KEY;
  const binId = process.env.JSONBIN_USERS_BIN_ID;
  if (!apiKey || !binId) throw new Error('JSONBIN_API_KEY atawa JSONBIN_USERS_BIN_ID can diatur');

  const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: { 'X-Master-Key': apiKey },
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Gagal muka database pamaké');
  return (data.record && data.record.users) || [];
}

async function saveUsers(users) {
  const apiKey = process.env.JSONBIN_API_KEY;
  const binId = process.env.JSONBIN_USERS_BIN_ID;
  await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
    body: JSON.stringify({ users }),
  });
}

function ensureFreshUsage(user) {
  const today = todayStr();
  if (!user.usage || user.usage.date !== today) {
    user.usage = { date: today, chat: 0, image: 0, video: 0 };
  }
  return user;
}

async function checkAndIncrement(email, type) {
  if (!email) return { allowed: true, remaining: 999, limit: 999, isPremium: false };

  const users = await fetchUsers();
  const emailNorm = email.trim().toLowerCase();
  const user = users.find((u) => u.email === emailNorm);
  if (!user) return { allowed: true, remaining: 999, limit: 999, isPremium: false };

  ensureFreshUsage(user);

  const limits = user.isPremium ? PREMIUM_LIMITS : LIMITS;
  const limit = limits[type];
  const used = user.usage[type] || 0;

  if (used >= limit) {
    return { allowed: false, remaining: 0, limit, isPremium: !!user.isPremium };
  }

  user.usage[type] = used + 1;
  await saveUsers(users);

  return { allowed: true, remaining: limit - user.usage[type], limit, isPremium: !!user.isPremium };
}

async function getStatus(email) {
  if (!email) return { isPremium: false, chatRemaining: LIMITS.chat, imageRemaining: LIMITS.image, videoRemaining: LIMITS.video };

  const users = await fetchUsers();
  const emailNorm = email.trim().toLowerCase();
  const user = users.find((u) => u.email === emailNorm);
  if (!user) return { isPremium: false, chatRemaining: LIMITS.chat, imageRemaining: LIMITS.image, videoRemaining: LIMITS.video };

  ensureFreshUsage(user);
  const limits = user.isPremium ? PREMIUM_LIMITS : LIMITS;

  return {
    isPremium: !!user.isPremium,
    chatRemaining: Math.max(0, limits.chat - (user.usage.chat || 0)),
    imageRemaining: Math.max(0, limits.image - (user.usage.image || 0)),
    videoRemaining: Math.max(0, limits.video - (user.usage.video || 0)),
  };
}

async function redeemCode(email, code) {
  const validCode = process.env.PREMIUM_CODE;
  if (!validCode) return { success: false, error: 'PREMIUM_CODE can diatur di server' };
  if (!code || code !== validCode) return { success: false, error: 'Kode salah' };

  const users = await fetchUsers();
  const emailNorm = (email || '').trim().toLowerCase();
  const user = users.find((u) => u.email === emailNorm);
  if (!user) return { success: false, error: 'Akun teu kapanggih' };

  user.isPremium = true;
  await saveUsers(users);
  return { success: true };
}

module.exports = { checkAndIncrement, getStatus, redeemCode, LIMITS, PREMIUM_LIMITS };
