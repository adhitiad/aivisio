import { createFileRoute } from '@tanstack/react-router'
import { LegalShell, LegalSection } from '@/components/legal/legal-shell'
import { useLocale, useT } from '@/lib/i18n'

export const Route = createFileRoute('/policy')({
  head: () => ({ meta: [{ title: 'Kebijakan Penggunaan · AIVISO' }] }),
  component: PolicyPage,
})

function PolicyPage() {
  const t = useT('pages.policy')
  const locale = useLocale()
  const id = locale === 'id'

  return (
    <LegalShell title={t('title')} updated={t('updated')}>
      <LegalSection title={id ? '1. Tujuan' : '1. Purpose'}>
        {id
          ? 'Kebijakan ini menjelaskan aturan penggunaan AIVISO agar platform tetap aman, adil, dan produktif bagi semua kreator.'
          : 'This policy sets the rules for using AIVISO so the platform stays safe, fair, and productive for all creators.'}
      </LegalSection>

      <LegalSection title={id ? '2. Konten yang Dilarang' : '2. Prohibited Content'}>
        {id
          ? 'Konten yang melanggar hukum Indonesia/internasional, pornografi, kekerasan ekstrem, ujaran kebencian, pelecehan, penipuan, serta konten yang meniru/mengklaim kepemilikan karya pihak lain tanpa izin.'
          : 'Content violating Indonesian/international law, pornography, extreme violence, hate speech, harassment, fraud, or content impersonating/claiming others\' work without permission.'}
      </LegalSection>

      <LegalSection title={id ? '3. Penggunaan AI yang Bertanggung Jawab' : '3. Responsible AI Use'}>
        {id
          ? 'Anda bertanggung jawab meninjau output AI sebelum publikasi: periksa fakta, hak cipta, dan kesesuaian dengan pedoman komunitas YouTube. Label AI pada konten yang dimodifikasi AI adalah praktik yang baik.'
          : 'You are responsible for reviewing AI output before publishing: check facts, copyright, and YouTube community guidelines. Labeling substantially AI-generated content is good practice.'}
      </LegalSection>

      <LegalSection title={id ? '4. Batas Pemakaian & Fair Use' : '4. Rate Limits & Fair Use'}>
        {id
          ? 'Endpoint tertentu dibatasi lajunya untuk menjaga stabilitas (mis. formulir kontak: 5 pesan/10 menit per IP). Penyalahgunaan kuota dapat menyebabkan pembatasan akses sementara atau permanen.'
          : 'Certain endpoints are rate-limited to protect stability (e.g. contact form: 5 messages/10 min per IP). Abuse of quota may result in temporary or permanent access restriction.'}
      </LegalSection>

      <LegalSection title={id ? '5. Penegakan' : '5. Enforcement'}>
        {id
          ? 'Pelanggaran dapat berakibat: peringatan, penghapusan konten, penangguhan akun. Pelanggaran berat (ilegal/keamanan) dapat dilaporkan ke otoritas yang berwenang.'
          : 'Violations may result in: warnings, content removal, account suspension. Severe violations (illegal/security) may be reported to competent authorities.'}
      </LegalSection>

      <LegalSection title={id ? '6. Pelaporan' : '6. Reporting'}>
        {id
          ? 'Lihat konten/perilaku yang melanggar? Laporkan melalui halaman Hubungi Kami dengan subjek “Laporan Penyalahgunaan”.'
          : 'See content/behavior that violates this policy? Report it via the Contact page with the subject “Abuse Report”.'}
      </LegalSection>
    </LegalShell>
  )
}
