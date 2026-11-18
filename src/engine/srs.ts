/**
 * Spaced repetition dengan algoritma FSRS (library ts-fsrs).
 *
 * Kenapa FSRS dan bukan interval tetap (1-3-7-14-30 hari)?
 * FSRS memperkirakan kapan Anda hampir lupa sebuah kata, berdasarkan riwayat jawaban
 * Anda sendiri. Kata yang mudah muncul makin jarang; kata yang sulit muncul lebih sering.
 */
import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';
import type { FsrsState, MasteryLevel, ReviewRating, VocabCard } from '../db/schema';

const scheduler = fsrs({
  request_retention: 0.9, // target: 90% kata masih ingat saat jadwal review tiba
  maximum_interval: 365,
  enable_fuzz: true, // sedikit acak agar review tidak menumpuk di hari yang sama
  enable_short_term: true, // langkah singkat (menit) untuk kata yang baru dipelajari
});

export const RATING_LABELS: Record<ReviewRating, { label: string; hint: string }> = {
  1: { label: 'Lupa', hint: 'Again' },
  2: { label: 'Sulit', hint: 'Hard' },
  3: { label: 'Bisa', hint: 'Good' },
  4: { label: 'Mudah', hint: 'Easy' },
};

function toCard(s: FsrsState): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    reps: s.reps,
    lapses: s.lapses,
    learning_steps: s.learningSteps,
    state: s.state,
    last_review: s.lastReview === null ? undefined : new Date(s.lastReview),
  };
}

function fromCard(c: Card): FsrsState {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    learningSteps: c.learning_steps,
    state: c.state as FsrsState['state'],
    lastReview: c.last_review ? c.last_review.getTime() : null,
  };
}

/** Kartu baru untuk kata yang baru diperkenalkan; langsung jatuh tempo agar dilatih hari itu juga. */
export function newVocabCard(wordId: string, now = Date.now()): VocabCard {
  const state = fromCard(createEmptyCard(new Date(now)));
  return { wordId, fsrs: state, due: state.due, mastery: 0, firstSeenAt: now, updatedAt: now };
}

/**
 * Penguasaan dari flashcard hanya bisa naik sampai "dikenali" (1).
 * Tingkat 2–4 hanya naik dari bukti lain: benar di bacaan, dipakai di tulisan.
 */
function masteryAfterReview(current: MasteryLevel, rating: ReviewRating): MasteryLevel {
  if (rating === 1) return current === 0 ? 0 : current; // lupa tidak menurunkan bukti pemakaian
  return current < 1 ? 1 : current;
}

export interface ReviewResult {
  card: VocabCard;
  scheduledDays: number;
}

export function reviewCard(card: VocabCard, rating: ReviewRating, now = Date.now()): ReviewResult {
  const result = scheduler.next(toCard(card.fsrs), new Date(now), rating as Grade);
  const fs = fromCard(result.card);
  return {
    card: { ...card, fsrs: fs, due: fs.due, mastery: masteryAfterReview(card.mastery, rating), updatedAt: now },
    scheduledDays: fs.scheduledDays,
  };
}

/** Pratinjau kapan kartu muncul lagi untuk tiap tombol, mis. "10 mnt", "1 hr", "4 hr". */
export function previewIntervals(card: VocabCard, now = Date.now()): Record<ReviewRating, string> {
  const preview = scheduler.repeat(toCard(card.fsrs), new Date(now));
  const out = {} as Record<ReviewRating, string>;
  for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const) {
    out[r as ReviewRating] = formatInterval(preview[r].card.due.getTime() - now);
  }
  return out;
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} mnt`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} jam`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} hr`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} bln`;
  return `${(days / 365).toFixed(1)} thn`;
}
