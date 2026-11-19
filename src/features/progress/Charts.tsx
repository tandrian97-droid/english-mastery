import { useState } from 'react';

/**
 * Grafik SVG ringan (tanpa library) untuk halaman Progres.
 * Warna seri: slot 1 (biru) dan slot 2 (oranye) dari palet tervalidasi
 * (lolos uji buta warna, kontras, dan kecerahan). Teks selalu memakai warna teks, bukan warna seri.
 */
const S1 = '#2a78d6';
const S2 = '#eb6834';
const GRID = '#e1e0d9';
const AXIS = '#c3c2b7';
const INK = '#1b1f29';
const MUTED = '#5b6475';

function Tooltip({ x, y, width, lines }: { x: number; y: number; width: number; lines: string[] }) {
  const w = Math.max(...lines.map((l) => l.length)) * 6.6 + 16;
  const left = Math.min(Math.max(x - w / 2, 0), width - w);
  return (
    <g pointerEvents="none">
      <rect x={left} y={y} width={w} height={lines.length * 16 + 10} rx={6} fill="#ffffff" stroke={AXIS} />
      {lines.map((l, i) => (
        <text key={i} x={left + 8} y={y + 18 + i * 16} fontSize={12} fill={i === 0 ? MUTED : INK} fontWeight={i === 0 ? 400 : 600}>
          {l}
        </text>
      ))}
    </g>
  );
}

function TableView({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details>
      <summary className="link-btn">Lihat sebagai tabel</summary>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Menit belajar per hari (30 hari), dengan garis target. */
export function MinutesChart({ days, target }: { days: { date: string; minutes: number }[]; target: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 200;
  const pad = { l: 34, r: 8, t: 12, b: 24 };
  const max = Math.max(target, ...days.map((d) => d.minutes)) * 1.1;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / days.length;
  const bw = Math.max(3, slot - 2); // celah 2px antar batang
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 30, 60, 90, 120, 150, 180].filter((t) => t <= max);

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Menit belajar per hari, ${days.length} hari terakhir`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} fontSize={11} fill={MUTED} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} stroke={INK} strokeDasharray="4 4" strokeWidth={1} />
        <text x={W - pad.r} y={y(target) - 5} fontSize={11} fill={INK} textAnchor="end">
          target {target} mnt
        </text>
        {days.map((d, i) => {
          const x = pad.l + i * slot + (slot - bw) / 2;
          const h = Math.max(0, y(0) - y(d.minutes));
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={d.date}>
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + bw - r} Q${x + bw},${y(0) - h} ${x + bw},${y(0) - h + r} V${y(0)} Z`}
                  fill={S1}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
              {(i % 5 === 0 || i === days.length - 1) && (
                <text x={x + bw / 2} y={H - 6} fontSize={10.5} fill={MUTED} textAnchor="middle">
                  {d.date.slice(8)}/{d.date.slice(5, 7)}
                </text>
              )}
            </g>
          );
        })}
        {hover !== null && <Tooltip x={pad.l + hover * slot + slot / 2} y={pad.t} width={W} lines={[days[hover].date, `${days[hover].minutes} menit`]} />}
      </svg>
      <TableView head={['Tanggal', 'Menit']} rows={days.filter((d) => d.minutes > 0).map((d) => [d.date, d.minutes])} />
    </figure>
  );
}

/** Akurasi per bagian: batang horizontal, satu seri, angka di ujung batang. */
export function AccuracyBars({ items }: { items: { label: string; pct: number | null; n: number }[] }) {
  return (
    <figure className="chart">
      <div className="hbars" role="list">
        {items.map((it) => (
          <div className="hbar" role="listitem" key={it.label} title={`${it.label}: ${it.pct ?? '—'}% dari ${it.n} jawaban`}>
            <span className="hbar-label">{it.label}</span>
            <span className="hbar-track">{it.pct !== null && <span className="hbar-fill" style={{ width: `${Math.max(it.pct, 2)}%`, background: S1 }} />}</span>
            <span className="hbar-value">{it.pct === null ? '—' : `${it.pct}%`}</span>
            <span className="hbar-n">{it.n}</span>
          </div>
        ))}
      </div>
      <p className="muted small">Angka kecil di kanan = jumlah jawaban. Akurasi dari sedikit jawaban belum bisa dipercaya.</p>
    </figure>
  );
}

/** Pertumbuhan kosakata: kata dikenal vs kata dikuasai (dipakai di tulisan). */
export function VocabGrowth({ points }: { points: { date: string; known: number; mastered: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="muted small">Grafik muncul setelah Anda belajar kosakata di 2 hari berbeda.</p>;
  const W = 640;
  const H = 200;
  const pad = { l: 34, r: 78, t: 12, b: 24 };
  const max = Math.max(10, ...points.map((p) => p.known)) * 1.1;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * iw;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const line = (k: 'known' | 'mastered') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[k])}`).join(' ');
  const step = Math.ceil(max / 4 / 10) * 10;
  const ticks = Array.from({ length: 5 }, (_, i) => i * step).filter((t) => t <= max);
  const last = points[points.length - 1];

  return (
    <figure className="chart">
      <div className="legend">
        <span>
          <i style={{ background: S1 }} /> Kata dikenal
        </span>
        <span>
          <i style={{ background: S2 }} /> Kata dikuasai (dipakai di tulisan)
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pertumbuhan kosakata" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} />
            <text x={pad.l - 6} y={y(t) + 4} fontSize={11} fill={MUTED} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <path d={line('known')} fill="none" stroke={S1} strokeWidth={2} strokeLinejoin="round" />
        <path d={line('mastered')} fill="none" stroke={S2} strokeWidth={2} strokeLinejoin="round" />
        <text x={x(points.length - 1) + 8} y={y(last.known) + 4} fontSize={11.5} fill={INK}>
          {last.known} dikenal
        </text>
        <text x={x(points.length - 1) + 8} y={y(last.mastered) + (Math.abs(y(last.mastered) - y(last.known)) < 14 ? 16 : 4)} fontSize={11.5} fill={INK}>
          {last.mastered} dikuasai
        </text>
        {[0, points.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} fontSize={10.5} fill={MUTED} textAnchor={i ? 'end' : 'start'}>
            {points[i].date.slice(8)}/{points[i].date.slice(5, 7)}
          </text>
        ))}
        {points.map((_, i) => (
          <rect key={i} x={x(i) - iw / points.length / 2} y={pad.t} width={iw / points.length} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke={AXIS} />
            <circle cx={x(hover)} cy={y(points[hover].known)} r={4} fill={S1} stroke="#fff" strokeWidth={2} />
            <circle cx={x(hover)} cy={y(points[hover].mastered)} r={4} fill={S2} stroke="#fff" strokeWidth={2} />
            <Tooltip x={x(hover)} y={pad.t} width={W - pad.r} lines={[points[hover].date, `${points[hover].known} dikenal`, `${points[hover].mastered} dikuasai`]} />
          </g>
        )}
      </svg>
      <TableView head={['Tanggal', 'Dikenal', 'Dikuasai']} rows={points.map((p) => [p.date, p.known, p.mastered])} />
    </figure>
  );
}
