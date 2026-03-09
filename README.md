# SIMANTAP.kemenagbtg

Aplikasi SIMANTAP berbasis React + Firebase.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

## Build untuk hosting

```bash
npm run build
```

Hasil build ada di folder `dist/`. Upload isi folder tersebut ke layanan hosting statis (Vercel, Netlify, Firebase Hosting, cPanel static hosting, dll).

## Catatan konfigurasi Firebase

Kode saat ini menggunakan variabel global (`__firebase_config`, `__app_id`, `__initial_auth_token`) jika tersedia. Saat tidak tersedia, aplikasi akan fallback ke konfigurasi kosong/default.
Untuk production, disarankan migrasi ke `.env` Vite (`import.meta.env`) agar konfigurasi lebih konsisten di semua platform hosting.
