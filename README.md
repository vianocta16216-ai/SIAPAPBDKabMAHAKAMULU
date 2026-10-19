# SIAP APBD Mahakam Ulu — Cloudflare + Google Drive/R2

Paket ini berisi frontend SIAP APBD, Worker API, D1 untuk data dan audit, autentikasi akun, pembatasan akses per OPD, serta unggah dokumen ke Cloudflare R2 dan Google Drive (setelah secret layanan dikonfigurasi).

## Peran
- 1 Super Admin.
- 28 akun Operator OPD.
- 1 akun Verifikator BPKAD. **Hanya akun Verifikator BPKAD yang boleh mencatat verifikasi. Super Admin tidak memiliki hak verifikasi.** Akun Auditor/Irban/BPKP/PPUPD tidak disediakan sebagai akun verifikator dalam versi ini.
- Username dan password awal seluruhnya dibuat baru dan berbeda dari spreadsheet sumber. Lihat file Excel kredensial privat terpisah; jangan commit ke GitHub. Semua akun wajib mengganti password pada login pertama.

## Sebelum deploy
1. Repository GitHub sebaiknya privat. Unggah isi folder proyek saja; jangan unggah workbook kredensial privat atau file secret.
2. Jalankan `npm install`, `npx wrangler login`, dan `npx wrangler d1 create siap-apbd-mahulu`. Ganti `database_id` di `wrangler.toml` dengan ID yang diberikan Cloudflare.
3. Buat bucket R2: `npx wrangler r2 bucket create siap-apbd-mahulu-docs`.
4. Siapkan Google Drive API dan Service Account, lalu ikuti `GOOGLE_DRIVE_R2_SETUP.md` untuk secret.
5. Jalankan `npm run db:migrate:local` untuk uji lokal; kemudian `npm run db:migrate:remote` dan `npm run deploy`.
6. Login, ganti password, dan uji tiap akun.

## Penyimpanan dokumen
Panel “Dokumen OPD · Google Drive + R2” mengirim file ke API Worker. Worker menaruh salinan di R2 dan Google Drive, dengan folder Drive per OPD di bawah folder induk yang ditetapkan. Daftar dokumen dan unduh dilindungi sesi serta pengecekan OPD. Batas file 25 MB.

**Penting:** koneksi live tidak dapat diaktifkan dari ZIP saja. Anda harus menambahkan kredensial Google Drive ke Cloudflare Worker dan membuat bucket R2 pada akun Cloudflare Anda. Jangan mengirim private key atau token ke chat. Lakukan pengujian staging sebelum menyimpan dokumen resmi.

## API utama
- `POST /api/login`, `GET /api/me`, `POST /api/logout`, `POST /api/change-password`
- `GET/PUT /api/data` (operator hanya OPD sendiri; kontrol versi konflik)
- `POST /api/verify` (akun BPKAD saja)
- `GET/POST /api/documents`, `GET /api/documents/download?id=...`
- `GET/POST /api/admin/users` (Super Admin)


## Jika situs Anda memakai `*.pages.dev`

Paket ini menyertakan `functions/api/[[path]].js` untuk melayani endpoint `/api/*` pada Cloudflare Pages. Atur output directory ke `public`, pastikan folder `functions` ada di root project Pages, dan tambahkan binding D1 `DB` serta R2 `DOCS_R2` pada Settings > Functions. Ikuti `DEPLOY_CLOUDFLARE.md` sebelum deploy.
