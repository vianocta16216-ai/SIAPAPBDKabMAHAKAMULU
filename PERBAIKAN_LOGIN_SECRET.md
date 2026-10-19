# Perbaikan login SIAP APBD dengan Cloudflare Secret

## Sumber kredensial
Username/password awal diverifikasi dari Cloudflare Secret `SIAP_APBD_ACCOUNTS_JSON`, bukan dari `users.password_hash` di D1. D1 masih dipakai oleh fitur aplikasi untuk data OPD, metadata role, sesi, dan password yang sudah diganti. Jadi binding DB tetap dibutuhkan oleh aplikasi, tetapi ketidakcocokan hash password awal di D1 tidak lagi menyebabkan login ditolak.

## Pasang Secret Production
1. Buka Cloudflare Dashboard > Workers & Pages > pilih project `siapapbdkabmahakamulu` > Settings > Variables and Secrets.
2. Tambahkan variable dengan nama persis `SIAP_APBD_ACCOUNTS_JSON`, pilih tipe **Secret** (bukan Plaintext variable).
3. Buka file terpisah `SIAP_APBD_ACCOUNTS_SECRET.json` yang diberikan bersama ZIP, salin seluruh isi JSON satu baris, tempel sebagai nilai Secret, lalu simpan. File tersebut hanya berisi username, salt, dan hash password; tidak berisi password asli. Jangan commit file Secret ke GitHub.
4. Lakukan redeploy Production agar Secret tersedia pada Pages Functions.
5. Uji `/api/crypto-health` (harus `ok:true`) lalu login.

## Catatan keamanan dan database
- Jangan jalankan SQL reset password hanya untuk mengatasi mismatch ini.
- D1 masih perlu binding `DB` untuk data aplikasi dan sesi.
- Akun yang sudah mengganti password (`must_change_password=0`) menggunakan hash baru yang tersimpan di D1. Akun login awal (`must_change_password=1`) memakai kredensial dari Secret.
- Bila akun baru ada di Secret tetapi belum ada metadata di tabel `users`, API mengembalikan HTTP 503 dengan pesan yang menjelaskan bahwa metadata akun perlu disinkronkan.
