import { createFileRoute } from '@tanstack/react-router'
import { LegalShell, LegalSection } from '@/components/legal/legal-shell'
import { useLocale, useT } from '@/lib/i18n'

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Kebijakan Privasi · AIVISO' }] }),
  component: PrivacyPage,
})

function PrivacyPage() {
  const t = useT('pages.privacy')
  const locale = useLocale()
  const id = locale === 'id'

  return (
    <LegalShell title={t('title')} updated={t('updated')}>
      <LegalSection title={id ? '1. Data yang Kami Kumpulkan' : '1. Data We Collect'}>
        {id
          ? 'Akun: email, nama, dan foto profil dari Google/Facebook, disimpan saat Anda masuk. Konten: input form dan hasil generasi AI, disimpan sebagai riwayat yang bisa Anda hapus. Teknis: log server minimal (tanpa isi konten sensitif) untuk keamanan dan pemecahan masalah.'
          : 'Account: email, name, and profile photo from Google/Facebook, stored when you sign in. Content: form input and AI output, stored as history you can delete. Technical: minimal server logs (never sensitive content) for security and troubleshooting.'}
      </LegalSection>

      <LegalSection title={id ? '2. Kata Sandi' : '2. Passwords'}>
        {id
          ? 'Kami TIDAK pernah meminta atau menyimpan kata sandi. Autentikasi sepenuhnya melalui Google dan Meta. Jika Anda melihat layar login yang meminta kata sandi mengatasnamakan AIVISO, itu phishing — laporkan ke kami.'
          : 'We NEVER ask for or store passwords. Authentication is handled entirely by Google and Meta. If a screen claiming to be AIVISO asks for a password, it is phishing — report it to us.'}
      </LegalSection>

      <LegalSection title={id ? '3. Cara Kami Menggunakan Data' : '3. How We Use Data'}>
        {id
          ? 'Untuk menjalankan layanan (menyimpan riwayat, mengelola provider AI, mengirim notifikasi), meningkatkan kualitas, dan menjaga keamanan. Kami tidak menjual data pribadi Anda.'
          : 'To operate the service (history, AI provider routing, notifications), improve quality, and keep the platform secure. We do not sell your personal data.'}
      </LegalSection>

      <LegalSection title={id ? '4. Pihak Ketiga' : '4. Third Parties'}>
        {id
          ? 'Google dan Meta untuk autentikasi; penyedia model AI yang Anda aktifkan (mis. Z.AI) untuk memproses prompt Anda sesuai kebijakan masing-masing. Saat provider pihak ketiga dipakai, input Anda dikirim ke mereka.'
          : 'Google and Meta for authentication; the AI model providers you enable (e.g. Z.AI) to process your prompts under their policies. When a third-party provider is used, your input is sent to them.'}
      </LegalSection>

      <LegalSection title={id ? '5. Cookie & Penyimpanan' : '5. Cookies & Storage'}>
        {id
          ? 'Cookie sesi BetterAuth untuk login, cookie NEXT_LOCALE untuk bahasa, dan preferensi tema (next-themes, localStorage). Tidak ada cookie iklan atau pelacakan lintas situs.'
          : 'BetterAuth session cookie for sign-in, NEXT_LOCALE for language, theme preference (next-themes, localStorage). No advertising or cross-site tracking cookies.'}
      </LegalSection>

      <LegalSection title={id ? '6. Hak Anda' : '6. Your Rights'}>
        {id
          ? 'Anda dapat menghapus riwayat generasi kapan saja dari Dasbor, dan meminta penghapusan akun + data terkait melalui halaman Hubungi Kami. Kami merespons permintaan dalam ≤ 30 hari.'
          : 'You may delete generation history at any time from the Dashboard, and request deletion of your account and related data via the Contact page. We respond within ≤ 30 days.'}
      </LegalSection>

      <LegalSection title={id ? '7. Keamanan' : '7. Security'}>
        {id
          ? 'Kami menerapkan header keamanan (CSP, HSTS, X-Frame-Options), validasi input, dan pembatasan laju. Tidak ada sistem yang 100% aman; laporkan kerentanan melalui Hubungi Kami.'
          : 'We apply security headers (CSP, HSTS, X-Frame-Options), input validation, and rate limiting. No system is 100% secure; report vulnerabilities via Contact Us.'}
      </LegalSection>

      <LegalSection title={id ? '8. Perubahan Kebijakan' : '8. Changes'}>
        {id
          ? 'Pembaruan material akan diumumkan di halaman ini. Tanggal pembaruan di atas menunjukkan versi berlaku.'
          : 'Material updates will be announced on this page. The date above indicates the current version.'}
      </LegalSection>
    </LegalShell>
  )
}
