// netlify/functions/lib/quota.js
// Helper cek & update kuota harian per deviceId, disimpan di JSONBin.
// Struktur data di JSONBin (satu objek besar):
// {
//   "device_abc123": { "date": "2026-07-05", "chatCount": 3, "imageCount": 1, "isPremium": false }
// }

const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${process.env.JSONBIN_BIN_ID}`;

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
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

/**
 * Cek & increment kuota untuk deviceId pada field tertentu ("chatCount" / "imageCount").
 * limit: batas harian. Kalau isPremium true, limit diabaikan.
 * Return: { allowed: bool, remaining: number, isPremium: bool }
 */
async function checkAndIncrement(deviceId, field, limit) {
  if (!deviceId) {
    throw new Error("deviceId wajib dikirim dari frontend");
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
  const record = await readBin();
  return !!record[deviceId]?.isPremium;
}

module.exports = { checkAndIncrement, isPremiumUser };
