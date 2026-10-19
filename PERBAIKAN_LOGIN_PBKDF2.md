# Perbaikan Login — PBKDF2 pada Cloudflare Workers/Pages

## Penyebab

Video menunjukkan pesan `Server gagal menghitung verifikasi password (PBKDF2)`. Error ini terjadi saat backend menghitung hash password; sistem belum sampai pada tahap membandingkan username/password. Aplikasi menyimpan hash PBKDF2-SHA256 dengan 210.000 iterasi, sedangkan pemanggilan `crypto.subtle.deriveBits()` pada runtime Cloudflare yang dipakai menolak parameter tersebut. Akibatnya, semua akun yang melalui jalur login yang sama gagal, bukan hanya akun tertentu.

## Perbaikan dalam source

- `src/index.js` memakai fungsi `pbkdf2` dari `node:crypto`, melalui API asynchronous.
- Jumlah iterasi tetap **210.000**, algoritma tetap SHA-256, output tetap 32 byte, dan salt tetap dibaca sebagai 16 byte hex. Ini mempertahankan kecocokan dengan hash akun yang telah dibuat dalam skrip perbaikan database dan tidak meminta reset atau penggantian password.
- `wrangler.toml` menambahkan `nodejs_compat` agar API Node.js crypto tersedia pada runtime Cloudflare.
- Endpoint diagnostik `/api/crypto-health` tetap tersedia untuk menguji proses PBKDF2 setelah deployment. Endpoint ini memakai input uji, bukan password akun.

## Cara memasang

1. Ganti source repository dengan isi ZIP perbaikan ini, pertahankan struktur root dan folder yang ada.
2. Tunggu deployment Cloudflare Pages selesai.
3. Buka `https://siapapbdkabmahakamulu.pages.dev/api/crypto-health`. Hasil yang diharapkan: HTTP 200 dengan `ok: true` dan `pbkdf2: "ok"`.
4. Buka `https://siapapbdkabmahakamulu.pages.dev/api/health`. Pastikan status database `ready`.
5. Muat ulang halaman login dengan hard refresh (Ctrl+F5), lalu uji akun. Tidak perlu menjalankan ulang skrip SQL hanya untuk mengatasi error PBKDF2 ini.

## Batas pengujian

Source dapat diperiksa dan diuji secara lokal dari arsip. Paket ini tidak memiliki akses ke akun Cloudflare maupun database D1 Production, sehingga hasil endpoint setelah deploy tetap perlu diperiksa pada lingkungan milik Anda. Jangan mengirim atau membagikan password akun dalam chat.
