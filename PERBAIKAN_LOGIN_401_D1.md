# Pemulihan login SIAP APBD (401 Password Mismatch)

## Apa arti error 401 ini?

Kode PBKDF2 sekarang berhasil berjalan pada 100.000 iterasi. HTTP 401 `PASSWORD_MISMATCH` berarti hash yang dihitung dari password yang dikirim browser tidak sama dengan `password_hash` yang dibaca API dari D1. Penyebab yang paling mungkin: SQL pembaruan kredensial belum dijalankan pada database yang benar, atau password yang dimasukkan tidak sama persis dengan password awal pada workbook privat.

Binding D1 pada `wrangler.toml` menunjuk database ID `4e9be2e3-44e0-442b-b5ed-93aa05c6632d` dan nama `siap-apbd-mahakamulu`. Skrip npm lama menunjuk nama berbeda, `siap-apbd-mahulu`, sehingga perintah sebelumnya dapat diarahkan ke database yang salah.

## Langkah perbaikan

1. Buat backup database D1 Production terlebih dahulu.
2. Perhatikan: perintah perbaikan berikut mengatur ulang kredensial 30 akun ke password awal dalam `SIAP_APBD_Akun_Baru_PRIVAT.xlsx`. Jangan jalankan jika Anda harus mempertahankan password baru yang telah diubah pengguna. SQL ini tidak menghapus `opd_data` atau `documents`.
3. Dari direktori proyek, jalankan `npm run db:repair-login:remote`. Perintah ini menggunakan ID D1 yang tercantum dalam `wrangler.toml`.
4. Jalankan `npm run db:verify-login:remote`. Untuk akun yang menggunakan password awal, status yang diharapkan adalah `MATCH_EXPECTED_100K`. Query verifikasi hanya membaca data; tidak menampilkan hash atau salt.
5. Di Cloudflare Pages > Settings > Functions > D1 database bindings, pastikan binding `DB` pada Production menunjuk ID `4e9be2e3-44e0-442b-b5ed-93aa05c6632d`. Jika ID binding berbeda, API akan membaca database lain dan login tetap dapat 401.
6. Periksa `/api/crypto-health`: hasil yang diharapkan `ok: true`, `pbkdf2: "ok"`, `iterations: 100000`. Setelah itu coba login ulang dengan mengetik password awal tepat seperti di workbook, tanpa spasi tambahan.

## Arti hasil pemeriksaan

- `NOT_FOUND_IN_THIS_DATABASE`: akun tidak ada di database yang sedang diperiksa.
- `HASH_OR_SALT_DOES_NOT_MATCH_EXPECTED_100K`: akun mungkin telah mengganti password atau SQL perbaikan belum diterapkan ke database ini.
- `ACCOUNT_INACTIVE`: akun berstatus nonaktif.

Jangan jalankan `0001_init.sql` ke Production untuk memperbaiki login dan jangan menghapus/menginisialisasi ulang database. Gunakan file `D1_REPAIR_ACCOUNT_CREDENTIALS.sql` pada database Production yang benar.
