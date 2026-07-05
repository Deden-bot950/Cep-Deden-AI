// netlify/functions/lib/quota.js
// Helper cek & update kuota harian per deviceId, disimpan di JSONBin.

const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function readBin() {
  const res = await fetch(`${JSONBIN_URL}/latest`, {
    headers: { "X-Master-Key": process.env.JSONBIN_API_KEY },
  });
  if (!res.ok) throw new Error("Gagal baca JSONBin: " + (await res.text()));
  const json = await res.json();
  return json.record || {};
}

async function writeBin(record) {
  const res = await fetch(JSONBIN_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": process.env.JSONBIN_API_KEY,
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error("Gagal simpan JSONBin: " + (await res.text()));
}

async function checkAndIncrement(deviceId, field, limit) {
  if (!deviceId) {
    // Kalau frontend belum kirim deviceId (belum di-update), jangan block - anggap 1 device umum
    deviceId = "anon_shared";
  }

  const record = await readBin();
  const today = todayStr();

  let entry = record[deviceId];
  if (!entry || entry.date !== today) {
    entry = { date: today, chatCount: 0, imageCount: 0, isPremium: entry?.isPremium || false };
  }

  if (!entry.isPremium && entry[field] >= limit) {
    return { allowed: false, remaining: 0, isPremium: false };
  }

  if (!entry.isPremium) {
    entry[field] = (entry[field] || 0) + 1;
  }

  record[deviceId] = entry;
  await writeBin(record);

  return {
    allowed: true,
    remaining: entry.isPremium ? -1 : Math.max(0, limit - entry[field]),
    isPremium: entry.isPremium,
  };
}

async function isPremiumUser(deviceId) {
  if (!deviceId) return false;
  const record = await readBin();
  return !!record[deviceId]?.isPremium;
}

module.exports = { checkAndIncrement, isPremiumUser };
