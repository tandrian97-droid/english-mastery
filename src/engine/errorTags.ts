/** Katalog jenis kesalahan: nama yang mudah dipahami, tips singkat, dan hari pelajarannya. */
export interface ErrorTagInfo {
  label: string;
  tip: string;
  day: number;
}

export const ERROR_TAGS: Record<string, ErrorTagInfo> = {
  'missing-be': { label: 'Lupa am/is/are', tip: 'Kalau tidak ada kata kerja aksi, kalimat butuh am/is/are: "I am hungry", bukan "I hungry".', day: 3 },
  'be-agreement': { label: 'Salah pilih am/is/are', tip: 'I → am · he/she/it/satu benda → is · you/we/they/banyak → are.', day: 3 },
  'double-verb': { label: 'Kata kerja dobel (I am work)', tip: 'Satu kalimat cukup satu lokomotif: "I work", bukan "I am work".', day: 3 },
  'he-she': { label: 'Tertukar he/she', tip: 'Sebelum berkata "dia", tanya dulu: laki-laki (he) atau perempuan (she)?', day: 2 },
  'his-her': { label: 'Tertukar his/her', tip: 'his/her mengikuti PEMILIK: milik Sara = her, milik Budi = his.', day: 6 },
  'possessive-order': { label: 'Urutan pemilik terbalik', tip: 'Pemilik di depan: "my name", bukan "name my".', day: 1 },
  'a-an': { label: 'Salah pilih a/an', tip: 'Lihat BUNYI kata berikutnya: vokal → an (an architect), konsonan → a (a house).', day: 5 },
  'missing-article': { label: 'Lupa a/an', tip: 'Satu benda/pekerjaan butuh a/an: "She is a designer".', day: 5 },
  'plural-s': { label: 'Lupa -s jamak', tip: 'Lebih dari satu = tambah -s, walau sudah ada angka: "two rooms".', day: 5 },
  'not-position': { label: 'Posisi not salah', tip: 'not diletakkan SETELAH am/is/are: "She is not busy".', day: 4 },
  'question-order': { label: 'Urutan pertanyaan', tip: 'Untuk bertanya, am/is/are pindah ke depan: "Are you ready?"', day: 4 },
  'at-here': { label: '"at here / at there"', tip: 'here dan there sudah berarti "di sini/di sana", tanpa "at".', day: 4 },
  'greeting-time': { label: 'Salah sapaan waktu', tip: 'Bertemu malam = Good evening; berpisah malam = Good night.', day: 1 },
  pronunciation: { label: 'Pengucapan belum jelas', tip: 'Putar versi pelan, perhatikan suku kata yang ditekan, tirukan 3 kali.', day: 0 },
  listening: { label: 'Dikte (menangkap kalimat)', tip: 'Dengar kalimat utuh dulu, lalu per kata. Kata kecil (a, the, is) paling sering terlewat.', day: 0 },
  vocab: { label: 'Arti kata', tip: 'Kata yang sering salah akan muncul lebih sering di flashcard.', day: 0 },
};

export function tagInfo(tag: string): ErrorTagInfo {
  return ERROR_TAGS[tag] ?? { label: tag, tip: '', day: 0 };
}
