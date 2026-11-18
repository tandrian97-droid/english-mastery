/** Ikon garis sederhana (24×24). Ditulis langsung agar tidak menambah dependensi. */
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const HomeIcon = () => (
  <svg {...base} aria-hidden="true"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></svg>
);
export const LearnIcon = () => (
  <svg {...base} aria-hidden="true"><path d="M2 6.5C4.5 5 8 5 12 7c4-2 7.5-2 10-.5V19c-2.5-1.5-6-1.5-10 .5-4-2-7.5-2-10-.5Z" /><path d="M12 7v12.5" /></svg>
);
export const VocabIcon = () => (
  <svg {...base} aria-hidden="true"><rect x="3" y="6" width="13" height="15" rx="2" /><path d="M8 3h11a2 2 0 0 1 2 2v13" /><path d="M7 11h5M7 15h3" /></svg>
);
export const TutorIcon = () => (
  <svg {...base} aria-hidden="true"><path d="M4 5h16v11H9l-5 4Z" /><path d="M9 9.5h.01M12 9.5h.01M15 9.5h.01" strokeWidth={2.6} /></svg>
);
export const ProgressIcon = () => (
  <svg {...base} aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const GearIcon = () => (
  <svg {...base} aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
);
export const PlayIcon = () => (
  <svg {...base} aria-hidden="true"><path d="M7 4.5v15l12-7.5Z" fill="currentColor" /></svg>
);
export const PauseIcon = () => (
  <svg {...base} aria-hidden="true"><path d="M8 5v14M16 5v14" strokeWidth={3} /></svg>
);
