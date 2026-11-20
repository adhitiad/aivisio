export interface ToolField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select'
  placeholder?: string
  options?: string[]
  required?: boolean
}

export interface Tool {
  id: string
  step: number
  name: string
  title: string
  tagline: string
  resultLabel: string
  icon: string
  accent: string
  fields: ToolField[]
  originalPrompt: string
}

export const TOOLS: Tool[] = [
  {
    id: 'rencana-kanal',
    step: 1,
    name: 'Rencana Kanal',
    title: 'Rencanakan Channel YouTube Anda',
    tagline:
      'Strategi lengkap meluncurkan channel dari nol: positioning, pilar konten, jadwal unggah, hingga jalur monetisasi.',
    resultLabel: 'Rencana Channel & Monetisasi',
    icon: 'rocket',
    accent: 'from-cyan-400 to-sky-500',
    fields: [
      {
        id: 'niche',
        label: 'Topik / bidang channel',
        type: 'text',
        placeholder: 'mis. kuliner street food, review gadget, edukasi keuangan',
        required: true,
      },
      {
        id: 'audience',
        label: 'Target audiens',
        type: 'text',
        placeholder: 'mis. mahasiswa 18-24 tahun yang ingin hidup hemat',
        required: true,
      },
      {
        id: 'resources',
        label: 'Sumber daya yang tersedia',
        type: 'textarea',
        placeholder:
          'mis. kamera HP, laptop biasa, budget Rp500rb/bulan, waktu luang 10 jam per minggu',
      },
      {
        id: 'goal',
        label: 'Tujuan jangka panjang',
        type: 'textarea',
        placeholder: 'mis. 100 ribu subscriber dalam 1 tahun dan menjadi full-time creator',
        required: true,
      },
      {
        id: 'stage',
        label: 'Kondisi saat ini',
        type: 'select',
        options: [
          'Belum punya channel (mulai dari nol)',
          'Sudah punya channel, di bawah 1.000 subscriber',
          'Sudah punya channel, 1.000 - 10.000 subscriber',
          'Sudah punya channel, di atas 10.000 subscriber',
        ],
      },
    ],
    originalPrompt:
      'Bertindaklah sebagai ahli strategi YouTube dan konsultan monetisasi. Buatlah rencana lengkap untuk meluncurkan channel YouTube saya dari nol dan menghasilkan uang melalui monetisasi. Evaluasi niche saya, target audiens, kompetitor, sumber daya yang tersedia, dan tujuan jangka panjang, lalu susun strategi mendetail yang mencakup: positioning channel, pilar konten, format video, jadwal unggah, pertumbuhan audiens, retensi penonton, peluang monetisasi, dan rencana aksi mingguan.',
  },
  {
    id: 'pilih-niche',
    step: 2,
    name: 'Pilih Niche',
    title: 'Temukan Niche Berpotensi Besar',
    tagline:
      'Analisis pasar mendalam: permintaan audiens, persaingan, peluang, monetisasi, plus daftar ide video siap produksi.',
    resultLabel: 'Analisis Niche & Ide Video',
    icon: 'target',
    accent: 'from-violet-400 to-purple-500',
    fields: [
      {
        id: 'interests',
        label: 'Minat, keahlian & pengalaman Anda',
        type: 'textarea',
        placeholder:
          'mis. suka memasak, pernah bekerja di bidang F&B, menguasai editing dasar, hobi touring',
        required: true,
      },
      {
        id: 'audience',
        label: 'Audiens yang ingin dijangkau',
        type: 'text',
        placeholder: 'mis. anak muda Indonesia yang baru pertama kali tinggal sendiri',
      },
      {
        id: 'constraints',
        label: 'Kondisi & batasan',
        type: 'textarea',
        placeholder:
          'mis. hanya bisa merekam di akhir pekan, modal terbatas, masih nyawer tampil di depan kamera',
      },
    ],
    originalPrompt:
      'Bertindaklah sebagai peneliti pasar YouTube berpengalaman. Identifikasi niche dengan permintaan audiens tinggi dan potensi pertumbuhan jangka panjang berdasarkan minat saya. Evaluasi tingkat persaingan, temukan peluang yang belum digarap, analisis potensi monetisasi dan keberlanjutan konten, serta cara agar channel saya menonjol dari kompetitor. Bangun identitas channel yang unik, tentukan audiens ideal, rekomendasikan kategori konten, dan buat daftar ide video yang diurutkan berdasarkan daya tarik bagi audiens.',
  },
  {
    id: 'skrip-viral',
    step: 3,
    name: 'Skrip & Hook Viral',
    title: 'Skrip Viral, Hook & Thumbnail',
    tagline:
      'Framework konten yang menaikkan CTR dan retensi: hook 5 detik pertama, alur cerita, konsep thumbnail, dan skrip utuh.',
    resultLabel: 'Hook, Skrip & Konsep Thumbnail',
    icon: 'pen',
    accent: 'from-fuchsia-400 to-pink-500',
    fields: [
      {
        id: 'topic',
        label: 'Topik video',
        type: 'text',
        placeholder: 'mis. 5 kesalahan umum saat menggoreng nasi goreng',
        required: true,
      },
      {
        id: 'format',
        label: 'Format video',
        type: 'select',
        options: [
          'Tutorial / How-to',
          'Listicle (daftar tips)',
          'Storytelling',
          'Review / Perbandingan',
          'Vlog / Behind the scene',
          'Edukasi / Explainer',
        ],
      },
      {
        id: 'duration',
        label: 'Durasi target',
        type: 'select',
        options: [
          'Shorts / Reels (di bawah 60 detik)',
          'Pendek (5-8 menit)',
          'Menengah (10-15 menit)',
          'Panjang (20 menit ke atas)',
        ],
      },
      {
        id: 'notes',
        label: 'Catatan gaya & audiens',
        type: 'textarea',
        placeholder:
          'mis. target pemula, gaya santai dan lucu, ada demonstrasi langsung di dapur',
      },
    ],
    originalPrompt:
      'Bertindaklah sebagai ahli strategi konten YouTube dan produser video profesional. Rancang framework konten untuk meningkatkan click-through rate dan retensi penonton untuk topik video saya. Sertakan: ide sudut pandang video, beberapa variasi hook untuk 5 detik pertama, konsep thumbnail beserta teks judulnya, struktur pembukaan, alur cerita, strategi menjaga penonton tetap menonton sampai habis, call-to-action yang natural, dan skrip lengkap siap dibaca.',
  },
  {
    id: 'algoritma-growth',
    step: 4,
    name: 'Algoritma & Growth',
    title: 'Pahami Algoritma YouTube',
    tagline:
      'Bedah cara kerja impresi, CTR, watch time, dan sistem rekomendasi — lalu strategi pertumbuhan yang bisa langsung dieksekusi.',
    resultLabel: 'Strategi Algoritma & Pertumbuhan',
    icon: 'trending',
    accent: 'from-sky-400 to-violet-500',
    fields: [
      {
        id: 'current',
        label: 'Kondisi channel saat ini',
        type: 'textarea',
        placeholder:
          'mis. 500 subscriber, 40 video, rata-rata 200 views per video, CTR 2%, retensi 35%',
        required: true,
      },
      {
        id: 'problem',
        label: 'Masalah utama yang dihadapi',
        type: 'select',
        options: [
          'Impresi sedikit (video tidak direkomendasikan)',
          'CTR rendah (yang melihat tidak klik)',
          'Retensi rendah (penonton cepat pergi)',
          'Subscriber stagnan',
          'Belum tahu, perlu diagnosis',
        ],
      },
      {
        id: 'frequency',
        label: 'Frekuensi unggah saat ini',
        type: 'select',
        options: [
          'Kurang dari 1x per bulan',
          '1-2x per bulan',
          'Sekitar 1x per minggu',
          '2-3x per minggu',
          'Hampir setiap hari',
        ],
      },
      {
        id: 'goal',
        label: 'Target pertumbuhan',
        type: 'text',
        placeholder:
          'mis. tembus 1.000 subscriber dan 4.000 jam tayang dalam 6 bulan',
      },
    ],
    originalPrompt:
      'Bertindaklah sebagai pakar strategi YouTube. Jelaskan cara kerja pertumbuhan YouTube secara praktis: impresi, click-through rate, watch time, retensi audiens, video yang disarankan, traffic pencarian, dan sistem rekomendasi. Kemudian susun strategi pertumbuhan yang bisa langsung dieksekusi untuk kondisi channel saya: frekuensi unggah yang ideal, cara menguji konten, optimalisasi performa video, cara berinteraksi dengan audiens, dan teknik mengubah penonton menjadi subscriber.',
  },
  {
    id: 'produksi-cepat',
    step: 5,
    name: 'Produksi 3x Cepat',
    title: 'Produksi Video 3x Lebih Cepat',
    tagline:
      'Workflow berbantuan AI dari riset sampai repurpose Shorts/TikTok/Reels, lengkap dengan rekomendasi tool dan checklist kualitas.',
    resultLabel: 'Workflow Produksi Berbantuan AI',
    icon: 'zap',
    accent: 'from-cyan-400 to-fuchsia-500',
    fields: [
      {
        id: 'content',
        label: 'Jenis konten yang diproduksi',
        type: 'text',
        placeholder: 'mis. video tutorial memasak 8-12 menit + shorts per resep',
        required: true,
      },
      {
        id: 'workflow',
        label: 'Proses produksi saat ini',
        type: 'textarea',
        placeholder:
          'mis. cari ide 1 jam, tulis naskah 3 jam, rekam 2 jam, edit 6 jam, thumbnail 1 jam',
      },
      {
        id: 'bottleneck',
        label: 'Tahap paling memakan waktu',
        type: 'select',
        options: [
          'Riset topik & ide',
          'Penulisan naskah',
          'Perekaman / shooting',
          'Editing',
          'Thumbnail & judul',
          'Publikasi & promosi',
        ],
      },
      {
        id: 'team',
        label: 'Tim produksi',
        type: 'select',
        options: ['Solo creator', 'Tim 2-3 orang', 'Tim 4 orang atau lebih'],
      },
    ],
    originalPrompt:
      'Bertindaklah sebagai manajer produksi YouTube profesional. Rancang workflow berbantuan AI agar saya bisa memproduksi video berkualitas tinggi 3x lebih cepat. Proses harus mencakup: riset topik, penulisan naskah, voice over, editing, desain thumbnail, publikasi, analisis data, dan repurpose konten untuk Shorts, TikTok, dan Reels. Rekomendasikan alat AI untuk setiap tahap, proses yang dapat digunakan berulang, template produksi, dan checklist kualitas untuk mengurangi pekerjaan yang tidak perlu tanpa mengorbankan kualitas konten.',
  },
  {
    id: 'dominasi-niche',
    step: 6,
    name: 'Dominasi Niche & Pendapatan',
    title: 'Riset Format Dominan SEA & Rencana Pendapatan',
    tagline:
      'Temukan format/konten yang paling dicari di YouTube Asia Tenggara untuk niche Anda, plus strategi monetisasi yang meningkatkan pendapatan secara signifikan.',
    resultLabel: 'Rencana Dominasi Niche & Monetisasi',
    icon: 'trending-up',
    accent: 'from-emerald-400 to-teal-500',
    fields: [
      {
        id: 'niche',
        label: 'Niche / topik channel',
        type: 'text',
        placeholder: 'mis. keuangan pribadi, review gadget, kuliner street food',
        required: true,
      },
      {
        id: 'country',
        label: 'Pasar utama (Asia Tenggara)',
        type: 'select',
        options: [
          'Indonesia',
          'Filipina',
          'Thailand',
          'Vietnam',
          'Malaysia',
          'Singapura',
          'Seluruh Asia Tenggara',
        ],
        required: true,
      },
      {
        id: 'stage',
        label: 'Kondisi channel saat ini',
        type: 'select',
        options: [
          'Belum monetisasi (di bawah 1.000 subs / 4.000 jam)',
          'Sudah monetisasi dasar (AdSense aktif)',
          'Sudah punya sponsor / affiliate',
          'Channel mapan (di atas 100 ribu subs)',
        ],
      },
      {
        id: 'resources',
        label: 'Sumber daya & kendala',
        type: 'textarea',
        placeholder:
          'mis. solo creator, budget Rp1jt/bulan, tidak mau tampil di kamera, bisa editing dasar',
      },
    ],
    originalPrompt:
      'Bertindaklah sebagai analis pasar YouTube dan konsultan monetisasi kreator Asia Tenggara. Untuk niche dan pasar yang saya sebutkan, lakukan riset mendalam dan rekomendasikan: (1) format & gaya konten yang PALING DOMINAN dicari penonton YouTube di pasar tersebut (Shorts vs long-form, faceless vs presenter, tutorial vs vlog vs listicle, dll.) beserta alasannya berdasarkan data tren; (2) angle/tema dengan CPM dan daya beli tertinggi untuk niche ini di pasar tersebut; (3) strategi monetisasi berlapis yang meningkatkan pendapatan secara signifikan di luar AdSense — YouTube Shopping/Shopee affiliate (khusus SEA), sponsor brand lokal, membership, Super Thanks, funnel Shorts ke long-form, lokalisasi/subtitle untuk ekspansi regional, dan upsell produk digital; (4) rencana 90 hari yang prioritas tinggi-ke-rendah, dengan KPI mingguan dan metrik yang harus dipantau; (5) risiko & kesalahan umum kreator di niche/pasar ini serta cara menghindarinya. Fokus pada FUNGSI dan dampak pendapatan, bukan pada desain visual. Berikan angka estimasi (CPM/RPM, konversi affiliate) yang realistis untuk pasar tersebut.',
  },
  {
    id: 'adaptasi-thumbnail',
    step: 7,
    name: 'Adaptasi Konten & Thumbnail CTR',
    title: 'Adaptasi Konten Akurat + Thumbnail AI untuk CTR Tinggi',
    tagline:
      'Campur & adaptasi konten akurat dari channel lain yang relevan, edit dengan AI agar nyaman ditonton & ditonton ulang, plus thumbnail yang menggoda klik tanpa menyesatkan.',
    resultLabel: 'Rencana Adaptasi Konten & Thumbnail CTR',
    icon: 'sparkles',
    accent: 'from-fuchsia-400 to-pink-500',
    fields: [
      {
        id: 'niche',
        label: 'Niche / topik',
        type: 'text',
        placeholder: 'mis. review gadget, edukasi keuangan, kuliner',
        required: true,
      },
      {
        id: 'reference',
        label: 'Channel/video referensi yang ingin diadaptasi',
        type: 'textarea',
        placeholder:
          'mis. link channel kompetitor, judul video yang performa tinggi, atau deskripsi gaya konten yang ingin ditiru (akurat & relevan)',
      },
      {
        id: 'audience',
        label: 'Target audiens',
        type: 'text',
        placeholder: 'mis. mahasiswa Indonesia 18-25 tahun',
      },
      {
        id: 'style',
        label: 'Gaya penayangan',
        type: 'select',
        options: [
          'Faceless (tanpa wajah)',
          'Presenter di kamera',
          'Campuran (faceless + potongan presenter)',
          'Shorts-first (vertical)',
        ],
      },
    ],
    originalPrompt:
      'Bertindaklah sebagai produser konten YouTube dan spesialis CTR/thumbnail. Untuk niche dan referensi yang saya berikan: (1) Analisis channel/video referensi yang performa tinggi — identifikasi struktur cerita, hook, pacing, visual style, dan elemen yang membuatnya nyaman ditonton & ditonton ulang; (2) Rancang rencana ADAPTASI (bukan copy-paste) konten dari sumber akurat yang relevan: campur fakta/data dari beberapa sumber terpercaya, susun ulang agar akurat, konsisten, dan nyaman ditonton berulang; sertakan checklist akurasi & anti-plagiarisme; (3) Rancang thumbnail yang "seperti video tetapi diedit lagi dengan AI": ambil elemen visual kunci dari video (subjek, ekspresi, warna dominan, teks), lalu edit/tingkatkan dengan AI (contrast tinggi, focal point jelas, emosi/curiosity gap, teks 3-5 kata, komposisi rule-of-thirds) agar orang lain ingin mengklik — tanpa clickbait menyesatkan; (4) Berikan 3-5 konsep thumbnail alternatif dengan alasan CTR masing-masing; (5) Rencana produksi langkah demi langkah (script, voice over, editing, thumbnail, judul, tags) plus metrik evaluasi (CTR target, AVD, retention curve). Fokus pada fungsi: tingkatkan klik & retensi, bukan sekadar estetika.',
  },
]

export function getToolById(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id)
}
