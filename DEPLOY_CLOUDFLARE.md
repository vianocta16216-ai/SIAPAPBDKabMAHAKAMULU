# SIAP APBD Mahakam Ulu — Cloudflare

Paket ini menggabungkan antarmuka HTML SIAP APBD yang diberikan dengan API Worker, Cloudflare D1, login berbasis sesi, pembatasan akses per OPD, pencatatan audit, kontrol konflik versi, dan alur catatan verifikasi.

## Penting sebelum produksi

- Akun awal di `migrations/0001_init.sql` hanya menyimpan salt dan hash PBKDF2; password plaintext tidak ada di repository.
- File kredensial awal diberikan terpisah dan **jangan pernah commit ke GitHub**. Karena file daftar akun pernah diunggah untuk pekerjaan ini, anggap semua password awal telah terekspos dan ganti setelah deployment/aktivasi.
- Password wajib diganti pada login pertama. Password baru minimal 12 karakter.
- Spreadsheet sumber berisi 28 Operator OPD, Super Admin, Auditor, Irban, dan BPKP. Karena permintaan menyebut PPUPD tetapi spreadsheet tidak memiliki akun PPUPD, paket ini menambahkan akun `verifikator_ppupd` dengan password acak terpisah di file kredensial privat.
- Frontend lama menyimpan banyak struktur data dalam satu model. Adapter ini menyimpan dataset per OPD dan memuat gabungan dataset untuk Super Admin/verifikator. Uji alur bisnis dan semua formulir secara menyeluruh di staging sebelum digunakan untuk data APBD resmi.
- Akun verifikator dapat melihat dataset dan menambahkan keputusan/catatan verifikasi; mereka tidak dapat menulis ulang data sumber melalui endpoint data. Inspektorat, auditor, Irban, BPKP, dan PPUPD bukan operator OPD.
- Tidak ada integrasi Google Sheets/Drive/R2 yang ditambahkan karena file sumber yang diberikan tidak mendefinisikan kredensial atau kontrak API untuk layanan tersebut.

## Arsitektur

- `public/index.html`: UI SIAP APBD, login, ganti password, adapter API, panel verifikasi, dan panel manajemen akun Super Admin.
- `src/index.js`: API Worker; autentikasi PBKDF2, token sesi, otorisasi server-side, penyimpanan data per OPD, kontrol konflik versi, audit log.
- `migrations/0001_init.sql`: tabel D1 dan hash akun awal.
- `wrangler.toml`: konfigurasi Cloudflare Worker + Static Assets.

## Deploy dari GitHub ke Cloudflare

1. Buat repository GitHub privat, lalu unggah seluruh isi folder paket ini. **Jangan unggah CSV kredensial privat.**
2. Pasang Node.js LTS di komputer, lalu jalankan:
   ```bash
   npm install
   npx wrangler login
   npx wrangler d1 create siap-apbd-mahulu
   ```
3. Salin `database_id` yang diberikan Cloudflare ke `wrangler.toml` menggantikan `REPLACE_WITH_D1_DATABASE_ID`.
4. Jalankan migrasi lokal untuk uji coba:
   ```bash
   npm run db:migrate:local
   npm run dev
   ```
5. Terapkan skema dan akun awal ke D1 produksi:
   ```bash
   npm run db:migrate:remote
   ```
6. Deploy:
   ```bash
   npm run deploy
   ```
7. Di Cloudflare Dashboard, buka Worker `siap-apbd-mahulu`, pastikan binding D1 bernama `DB` dan binding assets bernama `ASSETS` sudah terpasang sesuai `wrangler.toml`.
8. Login dengan akun awal dari file kredensial privat, ganti password, lalu uji akses operator OPD A dan pastikan tidak dapat membaca/menulis OPD B.
9. Setelah semua pengujian lolos, hubungkan domain khusus jika diperlukan.

## Pengujian wajib sebelum produksi

- Login salah, akun nonaktif, sesi kedaluwarsa, logout, dan wajib ganti password.
- Operator hanya melihat dan menyimpan data OPD sendiri.
- Dua operator pada OPD yang sama menyimpan bersamaan: versi lama harus ditolak dengan HTTP 409, bukan diam-diam menimpa data terbaru.
- Auditor/Irban/BPKP/PPUPD tidak dapat menggunakan endpoint PUT data.
- Keputusan verifikasi tercatat di `audit_log`.
- Uji seluruh form KAK, RAK, realisasi bulanan, RTL, risiko, laporan cetak, ekspor/impor, dan tampilan mobile. Beberapa fitur HTML awal mungkin mengasumsikan data lokal; jangan menganggap sistem telah tersertifikasi hanya karena login dan API berhasil.
- Atur Cloudflare WAF/rate limiting untuk `/api/login`; pantau error dan siapkan backup D1.

## API ringkas

- `POST /api/login`
- `GET /api/me`
- `POST /api/logout`
- `POST /api/change-password`
- `GET /api/data` (operator: dataset OPD sendiri; admin/verifikator: dataset yang diizinkan)
- `PUT /api/data` (operator OPD sendiri atau Super Admin; kontrol versi `baseVersion`)
- `POST /api/verify` (Super Admin, Auditor, Irban, BPKP, PPUPD)
- `GET/POST /api/admin/users` (Super Admin)

## Catatan tentang akun

Daftar akun awal mengikuti file `Tabel_Username_Password_Kawal_SPIP.xlsx` untuk 32 akun yang tercantum. Akun PPUPD tambahan dibuat karena peran tersebut disebut dalam permintaan tetapi tidak ada di spreadsheet. Username operator menggunakan `opd_key` berdasarkan username (mis. `opd_bpkad`) sebagai kunci tenant. Jika nama/kode OPD perlu diubah, lakukan melalui administrasi dan migrasi terkontrol.
