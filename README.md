# Cep Deden AI

Chat app pribadi dengan otak ganda (ChatGPT + Gemini), bisa upload & analisa gambar, generate gambar, generate video, voice input/output, dan riwayat chat sync antar HP lewat JSONBin.

## Struktur file

```
cep-deden-ai/
├── index.html                       ← frontend (satu file, mobile-friendly)
├── netlify.toml
└── netlify/functions/
    ├── chat.js                      ← proxy chat ke OpenAI & Gemini + cek kuota
    ├── generate-image.js            ← proxy generate gambar (Gemini) + cek kuota
    ├── generate-video.js            ← mulai generate video (Veo 3.1) + cek kuota
    ├── video-status.js              ← cek status & download video jadi
    ├── auth.js                      ← daptar/asup/panel admin (akun pamaké)
    ├── quota.js                     ← modul kuota + premium (dipaké fungsi séjén)
    ├── check-status.js              ← cek status premium & sesa kuota (GET)
    └── redeem-code.js               ← tukeurkeun kode premium
```

## Cara deploy (via GitHub + Netlify, seperti proyek-proyek Cep sebelumnya)

1. Push folder ini ke repo GitHub baru (misal `cep-deden-ai`).
2. Di Netlify: **Add new site → Import an existing project** → connect ke repo itu.
   Build command kosongkan saja, publish directory `.` (sudah diatur di `netlify.toml`).
3. Di Netlify **Site settings → Environment variables**, tambahkan:
   - `OPENAI_API_KEY` = API key ChatGPT punya Cep
   - `GEMINI_API_KEY` = API key Gemini punya Cep
   - `JSONBIN_API_KEY` = X-Master-Key JSONBin punya Cep (sarua jeung nu dipaké keur sync chat)
   - `JSONBIN_USERS_BIN_ID` = ID bin keur nyimpen akun pamaké (léngkah nyieunna aya di handap)
   - `ADMIN_PANEL_PASSWORD` = kecap sandi bébas keur muka Panel Admin (tempo daptar pamaké)
4. Deploy. Setelah selesai, buka URL Netlify-nya dari HP.

## Setup akun pamaké (login/daptar wajib)

Sateuacan aplikasi bisa dipaké, sadaya pengunjung kudu daptar heula (email + password). Data akun-na disimpen di JSONBin sacara sentral (béda ti bin keur riwayat chat per-HP).

**Léngkah nyieun bin keur akun (sakali wungkul):**
1. Buka jsonbin.io, login jeung akun anu sarua/béda ti nu keur chat sync
2. Jieun bin anyar, eusina persis: `{"users":[]}`
3. Sanggeus disimpen, copy **Bin ID**-na (katembong di URL atawa metadata)
4. Tempelkeun éta ID jadi env variable `JSONBIN_USERS_BIN_ID` di Netlify
5. Pastikeun `JSONBIN_API_KEY` (X-Master-Key jsonbin.io) ogé geus diisi

**Panel Admin:**
- Di sidebar aplikasi (☰), aya tombol "⚙️ Panel Admin"
- Asupkeun kecap sandi anu sarua jeung `ADMIN_PANEL_PASSWORD` keur tempo daptar sadaya pamaké (ngaran, email, tanggal daptar)
- Kecap sandi pamaké **teu pernah** katembong di panel ieu, ngan disimpen dina wangun hash (scrypt) di jero bin

## Wates pamakéan harian (kuota) + Premium

Pamaké gratis dibatesan **25 chat/poé, 10 gambar/poé, 2 video/poé**. Pamaké premium (nu geus redeem kode) meunang **200 chat/poé, 50 gambar/poé, 10 video/poé**. Wates ieu dicek langsung di server (`chat.js`, `generate-image.js`, `generate-video.js`) ngaliwatan modul `quota.js`, jadi teu bisa diakalan ti frontend.

Tambihkeun env variable anyar di Netlify:
- `PREMIUM_CODE` = kode rahasia rékaan Lur nyalira (contona `CEPDEDEN2026`) — bagikeun ka nu meli/menang promo

Pamaké bisa tukeurkeun kode ieu ngaliwatan tombol "🔑 Redeem Kode Premium" di sidebar aplikasi.

Lamun Lur hoyong ngarobih angka wates-na, buka `netlify/functions/quota.js`, ganti bagian `LIMITS` jeung `PREMIUM_LIMITS`.

## Tombol donasi

Aya tombol "☕ Traktir Cep Deden" di sidebar, nembongkeun QRIS jeung nomer rekening (a.n. Puput Dania) anu tos napel dina kode.

## Setup sync riwayat chat (JSONBin)

Saat pertama kali dibuka, aplikasi akan minta **JSONBin API Key** (X-Master-Key):
1. Buat akun gratis di jsonbin.io
2. Ambil **X-Master-Key** dari dashboard
3. Tempel saat diminta — aplikasi otomatis bikin bin baru dan mulai sync

Kalau di-skip, chat tetap tersimpan tapi cuma di HP itu saja (localStorage).

## Catatan penting soal biaya

- **Chat teks**: murah, ditagih per token (GPT-4o mini / Gemini Flash paling hemat).
- **Generate gambar** (mode 🎨): pakai Gemini image model, ±$0.04–0.07 per gambar.
- **Generate video** (mode 🎬): pakai **Veo 3.1** lewat Gemini API — **tidak ada tier gratis**, sekitar $0.15–0.40 per detik video (klip 8 detik ≈ $1.2–3.2). Proses generate video makan waktu 1–2 menit dan videonya ada watermark SynthID dari Google (standar semua video Veo).
- Voice input/output pakai Web Speech API bawaan browser HP — gratis, tapi kualitasnya tergantung browser (paling stabil di Chrome Android).

## Batasan yang perlu Cep tahu

- Video hasil generate dikirim balik sebagai base64 lewat Netlify Function — untuk klip pendek (±8 detik, 720p) biasanya aman, tapi kalau Netlify menolak response karena kelamaan/kebesaran, kabari saya supaya diganti alurnya (misal simpan ke storage lalu kasih link, bukan base64 langsung).
- Field response dari API Veo bisa berubah sewaktu-waktu karena masih model preview — kalau generate video error terus, kemungkinan besar Google mengubah skema response-nya dan function `video-status.js` perlu disesuaikan.
- Model yang dipakai default: GPT-4o mini & Gemini 2.5 Flash. Bisa ganti ke GPT-4o / Gemini 2.5 Pro dari dropdown di pojok kanan atas kalau butuh kualitas lebih tinggi (lebih mahal).
