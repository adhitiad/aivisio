import { createFileRoute } from '@tanstack/react-router'
import { LegalShell, LegalSection } from '@/components/legal/legal-shell'
import { useLocale, useT } from '@/lib/i18n'

export const Route = createFileRoute('/tos')({
  head: () => ({ meta: [{ title: 'Syarat & Ketentuan · AIVISO' }] }),
  component: TosPage,
})

function TosPage() {
  const t = useT('pages.tos')
  const locale = useLocale()
  const id = locale === 'id'

  return (
    <LegalShell title={t('title')} updated={t('updated')}>
      <LegalSection title={id ? '1. Penerimaan Ketentuan' : '1. Acceptance of Terms'}>
        {id
          ? 'Dengan mengakses atau menggunakan AIVISO, Anda menyetujui Syarat & Ketentuan ini dan Kebijakan Privasi kami. Jika Anda tidak setuju, jangan gunakan layanan ini.'
          : 'By accessing or using AIVISO, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use this service.'}
      </LegalSection>

      <LegalSection title={id ? '2. Deskripsi Layanan' : '2. Description of Service'}>
        {id
          ? 'AIVISO adalah studio bertenaga AI yang menghasilkan rekomendasi, skrip, dan konten untuk kreator YouTube. Hasil AI bersifat rekomendasi, bukan jaminan performa, pendapatan, atau monetisasi channel Anda.'
          : 'AIVISO is an AI-powered studio that generates recommendations, scripts, and content for YouTube creators. AI output is advisory; it does not guarantee performance, revenue, or channel monetization.'}
      </LegalSection>

      <LegalSection title={id ? '3. Akun & Autentikasi' : '3. Account & Authentication'}>
        {id
          ? 'Masuk hanya melalui Google atau Facebook — kami tidak menyimpan kata sandi. Anda bertanggung jawab atas aktivitas yang terjadi pada akun Anda. Beritahu kami segera jika terjadi penyalahgunaan.'
          : 'Sign-in is via Google or Facebook only — we never store passwords. You are responsible for activity under your account. Notify us immediately of any misuse.'}
      </LegalSection>

      <LegalSection title={id ? '4. Konten & Kepemilikan' : '4. Content & Ownership'}>
        {id
          ? 'Konten yang Anda buat dengan bantuan AIVISO adalah milik Anda, sepanjang tidak melanggar hak pihak ketiga. Anda memberi kami lisensi terbatas untuk memproses input Anda semata-mata demi menjalankan layanan.'
          : 'Content you create with AIVISO belongs to you, provided it does not infringe third-party rights. You grant us a limited license to process your input solely to operate the service.'}
      </LegalSection>

      <LegalSection title={id ? '5. Penggunaan yang Dilarang' : '5. Prohibited Use'}>
        {id
          ? 'Dilarang menggunakan layanan untuk konten ilegal, ujaran kebencian, disinformasi, spam, atau pelanggaran hak cipta; serta melakukan reverse-engineering, scraping massal, atau mengganggu infrastruktur kami.'
          : 'You may not use the service for illegal content, hate speech, disinformation, spam, or copyright infringement; nor reverse-engineer, mass-scrape, or disrupt our infrastructure.'}
      </LegalSection>

      <LegalSection title={id ? '6. Batasan Tanggung Jawab' : '6. Limitation of Liability'}>
        {id
          ? 'Layanan disediakan “sebagaimana adanya” tanpa jaminan apa pun. Sepanjang diizinkan hukum, AIVISO tidak bertanggung jawab atas kerugian tidak langsung, kehilangan data, atau hilangnya pendapatan yang timbul dari penggunaan layanan.'
          : 'The service is provided “as is” without warranties of any kind. To the extent permitted by law, AIVISO is not liable for indirect damages, data loss, or lost revenue arising from use of the service.'}
      </LegalSection>

      <LegalSection title={id ? '7. Perubahan Ketentuan' : '7. Changes to Terms'}>
        {id
          ? 'Kami dapat memperbarui ketentuan ini sewaktu-waktu. Perubahan material akan diumumkan di halaman ini dengan tanggal pembaruan baru. Penggunaan berkelanjutan berarti Anda menyetujui perubahan tersebut.'
          : 'We may update these terms at any time. Material changes will be announced on this page with a new update date. Continued use constitutes acceptance of the changes.'}
      </LegalSection>

      <LegalSection title={id ? '8. Kontak' : '8. Contact'}>
        {id
          ? 'Pertanyaan tentang ketentuan ini: gunakan halaman Hubungi Kami.'
          : 'Questions about these terms: use the Contact Us page.'}
      </LegalSection>
    </LegalShell>
  )
}
