# Perbaikan login SIAP APBD — HTTP 500

Paket ini menambahkan diagnosis database ke `GET /api/health`, pesan yang lebih membantu pada `POST /api/login`, serta migrasi pemulihan non-destruktif untuk tabel/akun awal yang hilang.

## Arti hasil pemeriksaan

Setelah deployment baru selesai, buka:

`https://siapapbdkabmahakamulu.pages.dev/api/health`

- HTTP 200 dan `"database":"ready"`: binding D1 dan tabel inti sudah bisa dibaca. Coba login. Bila masih gagal, buka **Cloudflare Dashboard → Workers & Pages → project SIAP APBD → Functions → Logs** dan periksa pesan login.
- HTTP 503 dan `"database":"not_ready"`: binding D1 belum ada pada Production, atau migrasi/tabel inti belum siap. Respons akan menjelaskan kategori masalah tanpa membocorkan data akun.
- HTTP 405: deployment Pages belum memasukkan fungsi di `functions/api/[[path]].js`, atau Root directory/build output tidak tepat.

## Langkah pemulihan yang aman

1. **Jangan menghapus database atau bucket. Jangan membuat database baru untuk menggantikan yang sekarang.** Ambil backup D1 terlebih dahulu sebelum mengubah skema.
2. Di **Cloudflare → Workers & Pages → project SIAP APBD → Settings → Bindings → Production**, pastikan D1 binding memiliki nama persis `DB` dan menunjuk ke database SIAP APBD yang benar. Setelah mengubah binding, deploy ulang. Screenshot sebelumnya memperlihatkan binding `DB`, tetapi tidak memastikan bahwa migrasi tabel di database itu sudah lengkap.
3. Dari folder proyek ini, jalankan:

   ```bash
   npm install
   npx wrangler login
   npx wrangler d1 migrations list siap-apbd-mahulu --remote
   ```

4. Jika `0001_init.sql` telah diterapkan tetapi migrasi `0002_auth_schema_repair.sql` belum diterapkan, dan database yang dituju sudah dipastikan benar serta sudah di-backup, jalankan:

   ```bash
   npx wrangler d1 migrations apply siap-apbd-mahulu --remote
   ```

   `0002_auth_schema_repair.sql` memakai `CREATE TABLE IF NOT EXISTS` dan `INSERT OR IGNORE`, sehingga tidak menimpa password akun yang sudah ada atau dataset OPD yang sudah tersimpan. Migrasi ini memperbaiki tabel/seed yang hilang; migrasi ini tidak dapat memperbaiki tabel lama yang memiliki kolom dengan struktur berbeda.

5. **Perhatian sebelum menerapkan migrasi:** jika daftar migrasi menunjukkan `0001_init.sql` masih belum diterapkan, jangan jalankan perintah apply begitu saja pada database yang berisi data produksi tanpa meninjau dan membuat backup. Migrasi awal `0001_init.sql` menggunakan seed akun `INSERT OR REPLACE`, sehingga bila dijalankan terhadap database lama yang sudah berisi akun seed dengan password yang telah diganti, hash password seed itu dapat diganti kembali.
6. Commit/push perubahan folder proyek ke repository GitHub yang terhubung ke Pages, lalu tunggu **Production deployment** selesai. Untuk Pages, root project harus memuat folder `functions`, `src`, `migrations`, `public`, serta `package.json`; output directory tetap `public`.
7. Buka `/api/health` lagi. Hanya jika hasilnya HTTP 200 dan `database: ready`, coba login ulang.

## Cek database melalui SQL Console (opsional)

Pada D1 database SIAP APBD yang sama dengan binding `DB`, jalankan:

```sql
SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name IN ('users', 'sessions', 'audit_log', 'opd_data', 'documents')
ORDER BY name;
```

Hasil normal memuat kelima nama tabel tersebut. Jika migrasi tercatat telah diterapkan tetapi tabel tetap hilang, atau health masih 503 setelah `0002`, jangan menjalankan ulang `0001` secara manual. Periksa Logs dan lakukan perbaikan skema terarah.

## Keamanan akun dan kunci

File workbook akun privat berisi password awal dalam bentuk teks biasa. Jangan commit atau mengunggah workbook tersebut ke repository publik. Setelah login pulih, ganti password awal dengan password baru yang unik. Karena tangkapan layar pengaturan juga memuat informasi konfigurasi layanan, rotasi Google Service Account key disarankan jika kunci privat sempat terlihat penuh atau pernah dibagikan.
