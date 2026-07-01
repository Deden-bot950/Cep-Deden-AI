# Cep Deden AI

Chat app pribadi dengan otak ganda (ChatGPT + Gemini), bisa upload & analisa gambar, generate gambar, generate video, voice input/output, dan riwayat chat sync antar HP lewat JSONBin.

## Struktur file

```
cep-deden-ai/
├── index.html                       ← frontend (satu file, mobile-friendly)
├── netlify.toml
└── netlify/functions/
    ├── chat.js                      ← proxy chat ke OpenAI & Gemini
    ├── generate-image.js            ← proxy generate gambar (Gemini)
    ├── generate-video.js            ← mulai generate video (Veo 3.1)
    └── video-status.js              ← cek status & download video jadi
```

## Cara deploy (via GitHub + Netlify, seperti proyek-proyek Cep sebelumnya)

1. Push folder ini ke repo GitHub baru (misal `cep-deden-ai`).
2. Di Netlify: **Add new site → Import an existing project** → connect ke repo itu.
   Build command kosongkan saja, publish directory `.` (sudah diatur di `netlify.toml`).
3. Di Netlify **Site settings → Environment variables**, tambahkan:
   - `OPENAI_API_KEY` = API key ChatGPT punya Cep
   - `GEMINI_API_KEY` = API key Gemini punya Cep
4. Deploy. Setelah selesai, buka URL Netlify-nya dari HP.

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
