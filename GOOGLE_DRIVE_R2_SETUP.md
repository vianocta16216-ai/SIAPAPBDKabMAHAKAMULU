# Menautkan Google Drive dan R2 untuk dokumen SIAP APBD

Unggah dokumen dari panel aplikasi akan menyimpan file ke Cloudflare R2 dan Google Drive pada folder per OPD. Integrasi ini baru aktif setelah pemilik akun menyiapkan kredensial layanan. Saya tidak memiliki akses ke akun Cloudflare/Google Anda sehingga belum bisa mengaktifkan koneksi live dari sini.

## Cloudflare R2
1. Buat bucket `siap-apbd-mahulu-docs` di Cloudflare R2.
2. Pastikan binding `DOCS_R2` pada `wrangler.toml` mengarah ke nama bucket yang benar.

## Google Drive API
1. Buat/ pilih project di Google Cloud Console dan aktifkan Google Drive API.
2. Buat Service Account, buat private key JSON, lalu salin email service account.
3. Buat folder induk Drive untuk SIAP APBD. Bagikan folder induk itu ke email service account sebagai **Editor**. Jangan bagikan ke publik.
4. Simpan email, private key PEM dari JSON, dan ID folder induk sebagai Worker secrets/vars. Jangan taruh kredensial dalam GitHub.

Contoh perintah (jalankan dari folder proyek):
```bash
npx wrangler r2 bucket create siap-apbd-mahulu-docs
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GOOGLE_PRIVATE_KEY
npx wrangler secret put GOOGLE_DRIVE_ROOT_FOLDER_ID
```
`GOOGLE_PRIVATE_KEY` harus berupa nilai `private_key` lengkap dengan baris BEGIN/END; simpan sebagai secret, bukan teks dalam repository. `GOOGLE_DRIVE_ROOT_FOLDER_ID` adalah bagian ID dari URL folder induk.

5. Jalankan migrasi D1 remote, deploy Worker, lalu uji unggah satu dokumen uji dari akun OPD. Folder `SIAP_APBD_<opdKey>` akan dibuat otomatis. Pastikan file muncul di R2 dan Drive sebelum digunakan untuk dokumen resmi.

## Catatan keamanan
- File maksimum 25 MB. Dokumen tidak dibuat publik; akses unduh melalui API yang memeriksa sesi dan cakupan OPD.
- Akun operator hanya dapat mengunggah/membaca dokumen OPD-nya. Akun BPKAD dapat melihat dokumen OPD untuk keperluan verifikasi.
- Jika unggah Drive gagal, objek R2 yang baru diunggah dihapus agar tidak ada dokumen yang tersimpan hanya di satu tempat.
- Kredensial layanan Google dan token R2 tidak boleh dimasukkan ke ZIP publik, HTML, atau GitHub.
