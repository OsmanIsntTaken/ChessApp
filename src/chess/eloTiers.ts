export interface EloTier {
  minElo: number;
  maxElo: number;
  title: string;
  subtitle: string;
  badgeColor: string;
  depth: number;
  moveTimeMs: number;
  /** Probability [0..1] of picking a suboptimal candidate move (for < 1320 ELO calibration) */
  noiseRate: number;
  /** Candidate pool width for MultiPV when simulating lower ELOs */
  multiPv: number;
}

export const ELO_TIERS: EloTier[] = [
  {
    minElo: 100,
    maxElo: 299,
    title: 'Acemi Çaylak',
    subtitle: 'Taşları yeni tanıyan rahat rakip',
    badgeColor: '#6B7280',
    depth: 1,
    moveTimeMs: 120,
    noiseRate: 0.78,
    multiPv: 8,
  },
  {
    minElo: 300,
    maxElo: 599,
    title: 'Taş Avcısı',
    subtitle: 'Temel taş almalarını görür, tuzaklara açık',
    badgeColor: '#78716C',
    depth: 2,
    moveTimeMs: 160,
    noiseRate: 0.62,
    multiPv: 6,
  },
  {
    minElo: 600,
    maxElo: 899,
    title: 'Sokak Oyuncusu',
    subtitle: 'Hızlı hücumları sever, savunmada boşluk bırakır',
    badgeColor: '#65A30D',
    depth: 3,
    moveTimeMs: 220,
    noiseRate: 0.45,
    multiPv: 5,
  },
  {
    minElo: 900,
    maxElo: 1199,
    title: 'Meraklı Stratejist',
    subtitle: 'Açılış prensiplerini uygular, çatal arar',
    badgeColor: '#16A34A',
    depth: 4,
    moveTimeMs: 280,
    noiseRate: 0.28,
    multiPv: 4,
  },
  {
    minElo: 1200,
    maxElo: 1499,
    title: 'Orta Seviye Taktikçi',
    subtitle: 'Dengeli oyun kurar ve basit taktikleri cezalandırır',
    badgeColor: '#0D9488',
    depth: 5,
    moveTimeMs: 360,
    noiseRate: 0.14,
    multiPv: 3,
  },
  {
    minElo: 1500,
    maxElo: 1799,
    title: 'Kulüp Ustası',
    subtitle: 'Sağlam pozisyonel oyun ve keskin hesaplama',
    badgeColor: '#0284C7',
    depth: 6,
    moveTimeMs: 450,
    noiseRate: 0.05,
    multiPv: 2,
  },
  {
    minElo: 1800,
    maxElo: 2049,
    title: 'Bölge Şampiyonu',
    subtitle: 'Oyun ortası planları ve güçlü oyun sonu tekniği',
    badgeColor: '#2563EB',
    depth: 8,
    moveTimeMs: 550,
    noiseRate: 0,
    multiPv: 1,
  },
  {
    minElo: 2050,
    maxElo: 2299,
    title: 'Aday Usta (CM)',
    subtitle: 'Zorlu fedalar ve derin taktiksel sezgi',
    badgeColor: '#4F46E5',
    depth: 10,
    moveTimeMs: 650,
    noiseRate: 0,
    multiPv: 1,
  },
  {
    minElo: 2300,
    maxElo: 2499,
    title: 'FIDE Ustası (FM)',
    subtitle: 'Hatasız açılış teorisi ve soğukkanlı savunma',
    badgeColor: '#7C3AED',
    depth: 11,
    moveTimeMs: 750,
    noiseRate: 0,
    multiPv: 1,
  },
  {
    minElo: 2500,
    maxElo: 2699,
    title: 'Uluslararası Usta (IM)',
    subtitle: 'Turnuva seviyesinde derin varyant hesapları',
    badgeColor: '#C026D3',
    depth: 12,
    moveTimeMs: 850,
    noiseRate: 0,
    multiPv: 1,
  },
  {
    minElo: 2700,
    maxElo: 2949,
    title: 'Büyükusta (GM)',
    subtitle: 'Elit dünya seviyesi strateji ve kusursuz oyun sonu',
    badgeColor: '#D97706',
    depth: 14,
    moveTimeMs: 950,
    noiseRate: 0,
    multiPv: 1,
  },
  {
    minElo: 2950,
    maxElo: 3149,
    title: 'Süper Büyükusta',
    subtitle: 'Dünya şampiyonluğu düzeyinde amansız baskı',
    badgeColor: '#EA580C',
    depth: 15,
    moveTimeMs: 1100,
    noiseRate: 0,
    multiPv: 1,
  },
  {
    minElo: 3150,
    maxElo: 3200,
    title: 'Dahi',
    subtitle: 'Maksimum sinirsel hesaplama gücü · Sınır tanımaz',
    badgeColor: '#DC2626',
    depth: 16,
    moveTimeMs: 1300,
    noiseRate: 0,
    multiPv: 1,
  },
];

export const ELO_PRESETS = [
  { elo: 100, label: '100 · Acemi Çaylak' },
  { elo: 400, label: '400 · Taş Avcısı' },
  { elo: 800, label: '800 · Sokak Oyuncusu' },
  { elo: 1100, label: '1100 · Meraklı Stratejist' },
  { elo: 1400, label: '1400 · Orta Seviye' },
  { elo: 1700, label: '1700 · Kulüp Ustası' },
  { elo: 2000, label: '2000 · Bölge Şampiyonu' },
  { elo: 2200, label: '2200 · Aday Usta' },
  { elo: 2400, label: '2400 · FIDE Ustası' },
  { elo: 2600, label: '2600 · Uluslararası Usta' },
  { elo: 2800, label: '2800 · Büyükusta (GM)' },
  { elo: 3000, label: '3000 · Süper Büyükusta' },
  { elo: 3200, label: '3200 · Dahi' },
];

export function clampElo(elo: number): number {
  return Math.max(100, Math.min(3200, Math.round(elo / 50) * 50));
}

export function getEloTier(elo: number): EloTier {
  const clamped = Math.max(100, Math.min(3200, Math.round(elo)));
  for (const tier of ELO_TIERS) {
    if (clamped >= tier.minElo && clamped <= tier.maxElo) {
      return tier;
    }
  }
  return ELO_TIERS[ELO_TIERS.length - 1];
}
