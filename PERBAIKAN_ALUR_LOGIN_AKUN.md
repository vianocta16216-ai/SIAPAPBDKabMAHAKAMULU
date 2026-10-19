# Perbaikan alur login dan pengaturan akun

## Perubahan
- Menghapus layar wajib **Ganti password awal** setelah login. Password dapat diganti secara opsional lewat tombol **Akun & Password** di banner pengguna.
- Menambahkan tombol Tutup/Batal pada panel penggantian password.
- Verifikasi password saat ini mengambil kredensial dari `SIAP_APBD_ACCOUNTS_JSON` jika akun masih menggunakan password awal (`must_change_password=1`); sesudah password diganti, verifikasi berikutnya memakai hash password baru di D1.
- Token login tidak lagi disimpan di `localStorage`. Setiap pemuatan/refresh halaman kembali ke login, serta mencoba mengakhiri sesi server saat halaman ditinggalkan.
- Cache data aplikasi pada `localStorage` tetap dipertahankan; yang dihapus hanya token autentikasi.

## Deploy
Deploy folder proyek seperti biasa ke Cloudflare Pages. Pastikan Secret `SIAP_APBD_ACCOUNTS_JSON` yang sudah dipakai untuk login tetap tersedia di environment Production. Tidak ada migrasi database baru yang diperlukan untuk perubahan UI/sesi ini.
