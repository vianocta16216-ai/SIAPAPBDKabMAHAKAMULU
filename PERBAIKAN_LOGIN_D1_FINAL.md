# SIAP APBD — Perbaikan Login D1 (versi final)

## Diagnosis berdasarkan pengaturan yang dikirim

Pengaturan pada screenshot **sudah cocok untuk nama binding**: binding Pages bernama `DB`, dan target database `siap-apbd-mahakamulu` dengan ID `4e9be2e3-44e0-442b-b5ed-93aa05c6632d`, sama dengan target pada `wrangler.toml`. Jangan mengganti nama binding atau membuat database baru.

Itu hanya membuktikan target binding dipilih dengan benar; bukan membuktikan semua tabel dan kolom di target tersebut sesuai. Versi source sebelumnya memeriksa keberadaan tabel secara dangkal dan bisa mengubah beberapa kegagalan skema menjadi pesan 500 umum.

## Perubahan source

- `src/index.js`: `/api/health` sekarang memeriksa kolom wajib di tiap tabel dan memberi daftar tabel/kolom yang kurang.
- `src/index.js`: login memberi kode diagnosis berbeda (`USERS_SCHEMA`, `SESSIONS_SCHEMA`, `PASSWORD_HASH_SCHEMA`, `LOGIN_INFRASTRUCTURE`) sehingga kegagalan tidak disamarkan menjadi 500 generik.
- `src/index.js`: `sessions` dan `audit_log` boleh dibuat secara idempoten bila belum ada; kegagalan tulis audit tidak lagi menggagalkan login setelah password cocok.
- `public/index.html`: tombol tampil/sembunyikan password menggunakan SVG tetap disertakan dan berlaku untuk kolom password yang sudah ada maupun form yang dibuat dinamis.
- `D1_REPAIR_LOGIN_SAFE.sql`: skrip pemulihan lengkap yang aman diulang; semua seed akun memakai `INSERT OR IGNORE`, bukan `INSERT OR REPLACE`, sehingga tidak menimpa password akun yang sudah ada.

## Urutan pemasangan

1. Buat backup D1 Production terlebih dahulu.
2. Deploy source dari arsip ini ke repository yang tersambung ke Pages (folder `public` tetap sebagai build output).
3. Buka **D1 Database → `siap-apbd-mahakamulu`** dengan ID yang cocok, kemudian jalankan isi lengkap `D1_REPAIR_LOGIN_SAFE.sql` satu kali lewat Console. Jangan menjalankan ulang `migrations/0001_init.sql`, karena versi awal menggunakan `INSERT OR REPLACE` untuk akun dan dapat mengganti hash password.
4. Tunggu deployment Pages Production selesai. Buka `https://siapapbdkabmahakamulu.pages.dev/api/health`.
5. Jika status bukan 200, periksa objek `issues` pada JSON: ia menyebut tabel/kolom yang belum cocok. Jika masih gagal login, respons API akan menyertakan kode diagnosis yang dapat dicari di Functions Logs.

## Batasan penting

Tidak ada akses langsung dari paket ini ke database Cloudflare Production, jadi login produksi tidak bisa diklaim telah diuji dari sini. Skrip repair aman untuk database yang memakai skema aplikasi ini; jika `users` sudah ada dengan skema yang berbeda, SQL akan berhenti pada pernyataan yang tidak kompatibel dan `/api/health` akan menunjukkan kolom yang perlu ditangani. Jangan hapus database atau tabel produksi untuk mengatasi masalah ini.
