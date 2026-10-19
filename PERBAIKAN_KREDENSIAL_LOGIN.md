# SIAP APBD — Perbaikan kredensial login yang benar

## Penting untuk error PBKDF2

Bila halaman login menampilkan `Server gagal menghitung verifikasi password (PBKDF2)`, **jangan jalankan SQL reset kredensial hanya untuk mengatasi pesan ini**. Hash pada skrip akun cocok dengan 30 password di workbook (100.000 iterasi); akar masalahnya adalah API hashing runtime, yang sudah diperbaiki di `src/index.js`. Deploy source baru lalu periksa `/api/crypto-health`. SQL pada dokumen ini hanya relevan jika pemeriksaan database memang menunjukkan kredensial yang tersimpan tidak valid atau akun di database berbeda.

## Mengapa sebelumnya belum teratasi

Script sebelumnya memakai `INSERT OR IGNORE`. Jika username sudah ada, SQLite melewati baris tersebut, sehingga `password_salt` dan `password_hash` lama yang rusak tidak diperbaiki. Binding `DB` yang terlihat pada screenshot memakai database yang sesuai; masalah saat ini ada pada data kredensial akun yang sudah tersimpan.

## Perbaikan aman

1. Buat backup D1 Production `siap-apbd-mahakamulu`.
2. Buka **D1 SQL Console** untuk database yang sama dengan binding Pages `DB`.
3. Jalankan seluruh `D1_REPAIR_ACCOUNT_CREDENTIALS.sql` dari ZIP ini. Script memperbarui hanya 30 username akun yang ada di workbook privat, memakai salt/hash PBKDF2 yang sudah diverifikasi terhadap password workbook. Password plaintext tidak ditulis ke SQL.
4. Pastikan query verifikasi di akhir memberi 30 baris dengan `credential_format = OK`.
5. Deploy source aplikasi yang sudah diperbarui agar endpoint `/api/health` melaporkan `invalidCredentialFormats: 0`. Lalu coba login dengan username/password sesuai workbook privat.

Script sengaja mengatur `active=1` dan `must_change_password=1` untuk 30 akun itu. Setelah login pertama, user harus mengganti password. `opd_data`, dokumen, dan data realisasi tidak diubah.

**Jangan mengirim atau membagikan password, `password_salt`, atau `password_hash`.**
