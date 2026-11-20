# YouTube Publishing Domain Rules

Aturan ini melengkapi dokumentasi teknis P3.1–P3.8. Periksa implementasi aktual sebelum mengubah kontrak.

## Safety and idempotency

- Jangan menganggap timeout atau koneksi putus berarti YouTube gagal menerima upload.
- Sebelum retry manual setelah hasil upload ambigu, periksa YouTube Studio dan lakukan reconciliation. Hindari video duplikat.
- Jangan menghapus atau mengganti resumable session secara sembarang.
- Pertahankan upload session probing, offset reconciliation, retry/backoff, attempt budget, dan stale lease recovery yang sudah diterapkan.
- Jangan menganggap stale lease sebagai bukti bahwa video tidak dibuat di YouTube.
- Jangan menurunkan batas retry atau menghapus guard tanpa analisis dampak dan tes.

## Scheduling and worker

- Pastikan hanya satu worker memproses lease yang sama; hormati locking/lease ownership dan expiry.
- Scheduled publication harus mematuhi validasi waktu minimum yang diterapkan oleh kode saat ini. Dokumentasi live-test sebelumnya menyebut minimum 10 menit; verifikasi konstanta aktual sebelum mengubahnya.
- Scheduler heartbeat menunjukkan scheduler dieksekusi, bukan bukti upload berhasil.
- Jangan mengekspos cron bearer secret ke browser atau response API.
- Scheduler endpoints harus mempertahankan autentikasi dan respons aman.
- Jika mengubah route TanStack, perbarui route tree/generated typing dengan mekanisme yang konsisten.

## Observability and alerting

- Bedakan scheduler invocation, worker processing, upload outcome, dan publication status.
- Execution history harus mencatat run lifecycle, bukan hanya snapshot heartbeat.
- Alert harus punya fingerprint stabil, lifecycle active/resolved, dan dedupe/idempotency untuk notification.
- Jangan membuat notifikasi berulang pada setiap polling untuk alert yang sama.
- Alert yang pulih harus ditandai resolved; kondisi yang muncul kembali merupakan aktivasi baru.
- Jangan menyimpan secret atau stack trace mentah pada alert/notification yang terlihat user.
- External monitor harus memanggil endpoint health yang tepat dengan secret dari secret manager/environment, bukan dari client.
- Nyatakan dengan jelas jika delivery hanya in-app. Jangan mengklaim email, SMS, push, atau webhook sudah tersedia jika belum diimplementasikan.

## Ownership and privacy

- Query dashboard dan alert user harus dibatasi pada user yang terautentikasi.
- Jangan mengungkap riwayat publikasi, judul video, channel, atau status pengguna lain.
- Periksa permission/ownership untuk setiap endpoint operasi.

## Operational validation

- CI bukan pengganti staging/production runtime validation.
- Catat apakah Prisma schema sudah diterapkan, scheduler sudah berjalan, heartbeat terverifikasi, dan notifikasi benar-benar diterima.
- Lakukan uji kegagalan hanya di staging atau lingkungan yang disetujui.
