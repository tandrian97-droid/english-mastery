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
  'third-person-s': { label: 'Lupa -s untuk he/she/it', tip: 'Simple present: he/she/it + kata kerja + s: "She works", "He watches".', day: 9 },
  'do-negative': { label: "Negatif dengan don't/doesn't", tip: "Kata kerja aksi: I don't understand (bukan I am not understand). She doesn't WORK (tanpa -s).", day: 10 },
  'do-question': { label: 'Pertanyaan dengan Do/Does', tip: 'Do you work…? Does she work…? Setelah does, kata kerja tanpa -s.', day: 10 },
  'frequency-position': { label: 'Posisi always/usually/never', tip: 'Sebelum kata kerja aksi (I always work), tapi setelah am/is/are (I am always busy).', day: 11 },
  'time-preposition': { label: 'at / in / on untuk waktu', tip: 'at + jam (at 8) · in + bagian hari/bulan (in the morning) · on + hari (on Monday).', day: 11 },
  'there-be': { label: 'There is / there are', tip: 'Satu benda: there is. Banyak: there are. "Ada" bukan "have".', day: 12 },
  'place-preposition': { label: 'in / on / under / next to', tip: 'on = menempel di permukaan (on the wall), in = di dalam (in the room), next TO = di sebelah.', day: 12 },
  'can-verb': { label: 'Can + kata kerja dasar', tip: 'can + bentuk dasar, tanpa -s dan tanpa to: She can draw.', day: 13 },
  'good-well': { label: 'good vs well', tip: 'good + benda/orang (a good designer) · well + cara melakukan (designs well).', day: 13 },
  capitalization: { label: 'Huruf besar', tip: 'Huruf besar di awal kalimat, untuk "I", dan untuk nama orang/tempat/hari.', day: 1 },
  punctuation: { label: 'Tanda baca', tip: 'Akhiri setiap kalimat dengan titik, tanda tanya, atau tanda seru.', day: 1 },
  'repeated-word': { label: 'Kata dobel', tip: 'Baca ulang tulisan sebelum menyimpan.', day: 0 },
  vocab: { label: 'Arti kata', tip: 'Kata yang sering salah akan muncul lebih sering di flashcard.', day: 0 },
};

export function tagInfo(tag: string): ErrorTagInfo {
  return ERROR_TAGS[tag] ?? { label: tag, tip: '', day: 0 };
}
