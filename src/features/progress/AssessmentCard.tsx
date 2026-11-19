import { useState, type FormEvent } from 'react';
import { db } from '../../db/db';
import { SKILL_LABELS, SKILLS, type CefrLevel, type Skill } from '../../db/schema';
import { toLocalDate } from '../../engine/dates';
import { useFeedback } from '../../ui/feedback';

const LEVELS: CefrLevel[] = ['PreA1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Mencatat hasil asesmen. Level di profil HANYA berubah dari sini (bukti nyata),
 * bukan dari jumlah pelajaran yang selesai.
 */
export function AssessmentForm() {
  const { notify, reportError } = useFeedback();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('EF SET');
  const [skill, setSkill] = useState<Skill>('reading');
  const [level, setLevel] = useState<CefrLevel>('A1');
  const [score, setScore] = useState('');
  const [date, setDate] = useState(toLocalDate());
  const [apply, setApply] = useState(true);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const numeric = score.trim() === '' ? null : Number(score);
      if (numeric !== null && (!Number.isFinite(numeric) || numeric < 0 || numeric > 1000)) {
        notify('warn', 'Skor harus angka 0–1000 atau dikosongkan.');
        return;
      }
      await db.transaction('rw', db.assessments, db.profile, async () => {
        await db.assessments.add({ date, kind: name === 'Asesmen aplikasi' ? 'internal' : 'external', name: name.trim() || 'Tes', skill, score: numeric, cefrEstimate: level, note: '' });
        if (apply) {
          const p = await db.profile.get(1);
          if (p) await db.profile.update(1, { levels: { ...p.levels, [skill]: level }, updatedAt: Date.now() });
        }
      });
      notify('info', `Hasil ${name} (${SKILL_LABELS[skill]} ${level}) tersimpan.`);
      setOpen(false);
    } catch (err) {
      reportError(err);
    }
  }

  if (!open)
    return (
      <button className="btn secondary" onClick={() => setOpen(true)}>
        Catat hasil tes
      </button>
    );

  return (
    <form className="stack form" onSubmit={submit}>
      <label className="stack">
        <span className="muted small">Nama tes</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} list="test-names" />
        <datalist id="test-names">
          <option value="EF SET" />
          <option value="Asesmen aplikasi" />
          <option value="IELTS" />
          <option value="TOEFL ITP" />
          <option value="Cambridge Linguaskill" />
        </datalist>
      </label>
      <div className="row">
        <label className="stack" style={{ flex: 1 }}>
          <span className="muted small">Skill</span>
          <select value={skill} onChange={(e) => setSkill(e.target.value as Skill)}>
            {SKILLS.map((s) => (
              <option key={s} value={s}>
                {SKILL_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="stack" style={{ flex: 1 }}>
          <span className="muted small">Level CEFR</span>
          <select value={level} onChange={(e) => setLevel(e.target.value as CefrLevel)}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l === 'PreA1' ? 'Pre-A1' : l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <label className="stack" style={{ flex: 1 }}>
          <span className="muted small">Skor (opsional)</span>
          <input type="number" inputMode="numeric" value={score} onChange={(e) => setScore(e.target.value)} />
        </label>
        <label className="stack" style={{ flex: 1 }}>
          <span className="muted small">Tanggal</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} />
        Jadikan level saya untuk skill ini
      </label>
      <div className="row">
        <button className="btn" type="submit">
          Simpan
        </button>
        <button className="btn secondary" type="button" onClick={() => setOpen(false)}>
          Batal
        </button>
      </div>
    </form>
  );
}
