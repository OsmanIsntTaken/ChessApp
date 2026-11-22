export interface OpeningEntry {
  moves: string;
  name: string;
}

const OPENING_BOOK: OpeningEntry[] = [
  { moves: 'e4 e5 Nf3 Nc6 Bb5 a6', name: 'İspanyol Açılışı (Ruy Lopez) · Morphy Savunması' },
  { moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6', name: 'İspanyol Açılışı · Berlin Savunması' },
  { moves: 'e4 e5 Nf3 Nc6 Bb5', name: 'İspanyol Açılışı (Ruy Lopez)' },
  { moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5', name: 'İtalyan Açılışı · Giuoco Piano' },
  { moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6', name: 'İtalyan Açılışı · İki At Savunması' },
  { moves: 'e4 e5 Nf3 Nc6 Bc4', name: 'İtalyan Açılışı' },
  { moves: 'e4 e5 Nf3 Nc6 d4 exd4', name: 'İskoç Açılışı' },
  { moves: 'e4 e5 Nf3 Nf6', name: 'Petrov Savunması' },
  { moves: 'e4 e5 Nc3', name: 'Viyana Açılışı' },
  { moves: 'e4 e5 f4', name: 'Şah Gambiti' },
  { moves: 'e4 e5', name: 'Açık Oyun (1. e4 e5)' },
  { moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', name: 'Sicilya Savunması · Najdorf Varyantı' },
  { moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4', name: 'Sicilya Savunması · Açık Varyant' },
  { moves: 'e4 c5 c3', name: 'Sicilya Savunması · Alapin Varyantı' },
  { moves: 'e4 c5 Nf3', name: 'Sicilya Savunması' },
  { moves: 'e4 c5', name: 'Sicilya Savunması' },
  { moves: 'e4 e6 d4 d5 Nc3', name: 'Fransız Savunması · Klasik Varyant' },
  { moves: 'e4 e6 d4 d5 e5', name: 'Fransız Savunması · İlerleme Varyantı' },
  { moves: 'e4 e6 d4 d5', name: 'Fransız Savunması' },
  { moves: 'e4 e6', name: 'Fransız Savunması' },
  { moves: 'e4 c6 d4 d5 Nc3 dxe4', name: 'Caro-Kann Savunması · Klasik' },
  { moves: 'e4 c6 d4 d5 e5', name: 'Caro-Kann Savunması · İlerleme' },
  { moves: 'e4 c6 d4 d5', name: 'Caro-Kann Savunması' },
  { moves: 'e4 c6', name: 'Caro-Kann Savunması' },
  { moves: 'e4 d5 exd5 Qxd5', name: 'İskandinav Savunması' },
  { moves: 'e4 d5', name: 'İskandinav Savunması' },
  { moves: 'e4 d6 d4 Nf6 Nc3 g6', name: 'Pirc Savunması' },
  { moves: 'd4 d5 c4 e6 Nc3 Nf6', name: 'Vezir Gambiti · Reddedilen' },
  { moves: 'd4 d5 c4 c6', name: 'Slav Savunması' },
  { moves: 'd4 d5 c4 dxc4', name: 'Kabul Edilen Vezir Gambiti' },
  { moves: 'd4 d5 c4', name: 'Vezir Gambiti' },
  { moves: 'd4 d5 Bf4 Nf6 e3', name: 'Londra Sistemi' },
  { moves: 'd4 d5 Bf4', name: 'Londra Sistemi' },
  { moves: 'd4 Nf6 c4 g6 Nc3 Bg7', name: 'Şah Hint Savunması' },
  { moves: 'd4 Nf6 c4 e6 Nc3 Bb4', name: 'Nimzo-Hint Savunması' },
  { moves: 'd4 Nf6 c4 e6 Nf3 b6', name: 'Vezir Hint Savunması' },
  { moves: 'd4 Nf6 c4', name: 'Hint Savunması' },
  { moves: 'd4 d5', name: 'Kapalı Oyun (1. d4 d5)' },
  { moves: 'c4 e5', name: 'İngiliz Açılışı · Ters Sicilya' },
  { moves: 'c4 c5', name: 'İngiliz Açılışı · Simetrik' },
  { moves: 'c4', name: 'İngiliz Açılışı' },
  { moves: 'Nf3 d5', name: 'Réti Açılışı' },
  { moves: 'e4', name: 'Şah Piyonu Açılışı' },
  { moves: 'd4', name: 'Vezir Piyonu Açılışı' },
];

/**
 * Checks whether the current SAN move sequence matches a known opening book line
 * and returns the most specific opening name found.
 */
export function lookupOpening(sanMoves: string[]): { isBook: boolean; name: string } {
  if (sanMoves.length === 0) {
    return { isBook: false, name: 'Başlangıç Pozisyonu' };
  }
  const joined = sanMoves.join(' ');
  for (const entry of OPENING_BOOK) {
    if (joined === entry.moves) {
      return { isBook: true, name: entry.name };
    }
  }
  // Check longest prefix match for opening title even after leaving exact book line
  let bestMatch: OpeningEntry | null = null;
  for (const entry of OPENING_BOOK) {
    if (joined.startsWith(entry.moves + ' ')) {
      if (!bestMatch || entry.moves.length > bestMatch.moves.length) {
        bestMatch = entry;
      }
    }
  }
  if (bestMatch) {
    return { isBook: false, name: bestMatch.name };
  }
  return { isBook: false, name: 'Serbest Açılış' };
}
