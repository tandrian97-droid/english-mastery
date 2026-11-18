import { Fragment, type ReactNode } from 'react';

/**
 * Format ringan untuk teks materi: **tebal**, *miring*, ~~coret~~.
 * Sengaja tidak memakai HTML mentah agar materi tidak bisa menyisipkan kode.
 */
export function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith('***')) out.push(<strong key={i++}><em>{tok.slice(3, -3)}</em></strong>);
    else if (tok.startsWith('**')) out.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('~~')) out.push(<s key={i++}>{tok.slice(2, -2)}</s>);
    else out.push(<em key={i++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);
  return <>{out}</>;
}
