import { useLiveQuery } from 'dexie-react-hooks';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadAllWords, loadErrorTagIndex, loadWritingPrompts } from '../../content/load';
import type { WritingPrompt, WritingPrompts } from '../../content/types';
import { db } from '../../db/db';
import { deriveErrorStats } from '../../db/learning';
import type { Writing, WritingLevel } from '../../db/schema';
import { buildAiPrompt, createDraft, saveDraft, submitWriting } from '../../db/writing';
import { tagInfo } from '../../engine/errorTags';
import { checkWriting, type CheckResult, type WritingIssue } from '../../engine/writingCheck';
import { useFeedback } from '../../ui/feedback';
import { TimerChip } from '../../ui/TimerChip';

function usePrompts(): WritingPrompts | null {
  const [p, setP] = useState<WritingPrompts | null>(null);
  useEffect(() => {
    void loadWritingPrompts().then(setP);
  }, []);
  return p;
}

function findPrompt(all: WritingPrompts | null, id: string | null): { prompt: WritingPrompt; level: WritingLevel } | null {
  if (!all || !id) return null;
  for (const l of all.levels) {
    const p = l.prompts.find((x) => x.id === id);
    if (p) return { prompt: p, level: l.level };
  }
  return null;
}

/** Teks dengan bagian bermasalah ditandai. */
function Highlighted({ text, issues }: { text: string; issues: WritingIssue[] }) {
  const parts: React.ReactNode[] = [];
  let pos = 0;
  issues.forEach((i, k) => {
    if (i.start > pos) parts.push(<Fragment key={`t${k}`}>{text.slice(pos, i.start)}</Fragment>);
    parts.push(
      <mark key={`m${k}`} className={`issue ${i.kind}`} title={i.explanation}>
        {i.start === i.end ? '␣' : text.slice(i.start, i.end)}
        <sup>{k + 1}</sup>
      </mark>,
    );
    pos = Math.max(pos, i.end);
  });
  parts.push(<Fragment key="end">{text.slice(pos)}</Fragment>);
  return <p className="written">{parts}</p>;
}

function IssueList({ result }: { result: CheckResult }) {
  if (!result.issues.length) return <p className="small">Pemeriksa dasar tidak menemukan kesalahan. Untuk menilai kejelasan dan kealamian, gunakan AI Tutor.</p>;
  return (
    <ol className="issues">
      {result.issues.map((i, k) => (
        <li key={k}>
          <span className="badge">{tagInfo(i.errorTag).label}</span>{' '}
          {i.original ? <s>{i.original}</s> : <i>(akhir kalimat)</i>} → <strong>{i.suggestion}</strong>
          <div className="muted small">{i.explanation}</div>
        </li>
      ))}
    </ol>
  );
}

// ---------- Daftar topik & riwayat ----------

export function WritingHome() {
  const prompts = usePrompts();
  const navigate = useNavigate();
  const { reportError } = useFeedback();
  const profile = useLiveQuery(() => db.profile.get(1));
  const history = useLiveQuery(() => db.writings.orderBy('createdAt').reverse().toArray());
  const recommended = prompts?.levels.filter((l) => (profile?.curriculumDay ?? 1) >= l.fromDay).at(-1)?.level ?? 1;
  const [level, setLevel] = useState<number | null>(null);
  const shown = level ?? recommended;

  async function start(p: WritingPrompt | null, lvl: WritingLevel) {
    try {
      const id = await createDraft(p?.id ?? null, lvl, p?.title ?? 'Tulisan bebas');
      navigate(`/writing/${id}`);
    } catch (e) {
      reportError(e);
    }
  }

  const def = prompts?.levels.find((l) => l.level === shown);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Writing Studio</h1>
          <p className="sub">Menulis bebas dengan pemeriksa kesalahan offline</p>
        </div>
      </header>

      <div className="level-tabs" role="tablist">
        {prompts?.levels.map((l) => (
          <button key={l.level} role="tab" aria-selected={l.level === shown} className={`chip${l.level === shown ? ' chosen' : ''}`} onClick={() => setLevel(l.level)}>
            {l.level}. {l.title}
            {l.level === recommended && ' ★'}
          </button>
        ))}
      </div>

      {def && (
        <section className="card">
          <h2>
            Level {def.level}: {def.title}
          </h2>
          <p className="muted small">
            {def.desc} {def.level > recommended && `Disarankan mulai Hari ${def.fromDay}, tapi boleh dicoba.`}
          </p>
          <div className="list">
            {def.prompts.map((p) => (
              <div className="list-item" key={p.id}>
                <div>
                  <strong>{p.title}</strong>
                  <div className="muted small">{p.task}</div>
                </div>
                <button className="btn secondary small-btn" onClick={() => void start(p, def.level)}>
                  Tulis
                </button>
              </div>
            ))}
          </div>
          <button className="btn secondary" onClick={() => void start(null, def.level)}>
            Tulisan bebas (topik sendiri)
          </button>
        </section>
      )}

      <section className="card">
        <h2>Riwayat tulisan</h2>
        {!history?.length && <p className="muted">Belum ada tulisan.</p>}
        <div className="list">
          {history?.map((w) => (
            <Link key={w.id} to={`/writing/${w.id}`} className="list-item block-link">
              <div>
                <strong>{w.title}</strong>
                <div className="muted small">
                  {new Date(w.createdAt).toLocaleDateString('id-ID')} · {w.wordCount} kata · {w.promptId?.startsWith('d') ? 'dari latihan' : `level ${w.level}`}
                </div>
              </div>
              <span className={`badge ${w.status === 'draft' ? 'warn' : 'ok'}`}>{w.status === 'draft' ? 'draf' : 'selesai'}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------- Editor & hasil ----------

export function WritingEditor() {
  const id = Number(useParams().id);
  const writing = useLiveQuery(() => db.writings.get(id), [id]);
  if (writing === undefined) return <div className="page" aria-busy="true" />;
  return writing.status === 'draft' ? <Editor key={id} writing={writing} /> : <WritingResult writing={writing} />;
}

function Editor({ writing }: { writing: Writing }) {
  const prompts = usePrompts();
  const { reportError, notify } = useFeedback();
  const profile = useLiveQuery(() => db.profile.get(1));
  const [text, setText] = useState(writing.text);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const found = findPrompt(prompts, writing.promptId);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const profileName = profile?.name;
  const names = useMemo(() => (profileName ? [profileName] : []), [profileName]);

  function onChange(v: string) {
    setText(v);
    setResult(null);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveDraft(writing.id!, v).catch(reportError), 1200);
  }
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  async function submit() {
    if (!result) return;
    setBusy(true);
    try {
      await saveDraft(writing.id!, text);
      await submitWriting(writing.id!, text, result, await loadAllWords());
      notify('info', 'Tulisan disimpan. Teks asli Anda tidak akan diubah.');
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted small">
            <Link to="/writing">Writing Studio</Link> · Level {writing.level}
          </p>
          <h1>{writing.title}</h1>
        </div>
        <TimerChip />
      </header>
      {found && (
        <section className="card">
          <p>{found.prompt.task}</p>
          <p className="muted small">
            Contoh awal: <i>{found.prompt.hint}</i>
          </p>
        </section>
      )}
      <section className="card">
        <textarea className="editor" value={text} onChange={(e) => onChange(e.target.value)} rows={10} autoCapitalize="sentences" spellCheck={false} placeholder="Tulis dalam bahasa Inggris…" aria-label="Tulisan Anda" />
        <div className="row between">
          <span className="muted small">
            {words} kata{found ? ` · minimal ${found.prompt.minWords}` : ''} · draf tersimpan otomatis
          </span>
          <button className="btn" onClick={() => setResult(checkWriting(text, names))} disabled={!text.trim()}>
            Periksa
          </button>
        </div>
      </section>

      {result && (
        <section className="card">
          <div className="row between">
            <h2>Hasil pemeriksa dasar</h2>
            <span className={`badge ${result.score >= 80 ? 'ok' : result.score >= 50 ? 'warn' : 'bad'}`}>{result.score}/100</span>
          </div>
          <Highlighted text={text} issues={result.issues} />
          <IssueList result={result} />
          <p className="muted small">Perbaiki tulisan di atas lalu periksa lagi, atau simpan sekarang. Skor ini dari pemeriksa dasar (offline), bukan nilai CEFR.</p>
          <button className="btn block" onClick={() => void submit()} disabled={busy || (found ? words < Math.min(found.prompt.minWords, 5) : false)}>
            Selesai & simpan
          </button>
        </section>
      )}
    </div>
  );
}

function WritingResult({ writing }: { writing: Writing }) {
  const { notify, reportError } = useFeedback();
  const prompts = usePrompts();
  const feedback = useLiveQuery(() => db.writing_feedback.where('writingId').equals(writing.id!).toArray(), [writing.id]);
  const found = findPrompt(prompts, writing.promptId);
  const check = useMemo(() => checkWriting(writing.text), [writing.text]);
  const offline = feedback?.find((f) => f.source === 'offline');

  async function copyForAi() {
    try {
      const attempts = await db.exercise_attempts.filter((a) => !a.isCorrect).toArray();
      const top = deriveErrorStats(attempts, await loadErrorTagIndex())
        .slice(0, 3)
        .map((s) => s.errorTag);
      await navigator.clipboard.writeText(buildAiPrompt(writing, found?.prompt.task ?? writing.title, top));
      notify('info', 'Disalin. Tempel ke aplikasi Claude untuk koreksi lengkap.');
    } catch (e) {
      reportError(e);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted small">
            <Link to="/writing">Writing Studio</Link> · {new Date(writing.createdAt).toLocaleDateString('id-ID')}
          </p>
          <h1>{writing.title}</h1>
        </div>
      </header>
      <div className="grid two">
        <section className="card">
          <h2>Tulisan asli Anda</h2>
          <Highlighted text={writing.text} issues={check.issues} />
          <p className="muted small">{writing.wordCount} kata · teks asli tidak pernah diubah</p>
        </section>
        <section className="card">
          <div className="row between">
            <h2>Versi terkoreksi (dasar)</h2>
            {offline?.score != null && <span className="badge">{offline.score}/100</span>}
          </div>
          <p className="written">{check.corrected}</p>
          <IssueList result={check} />
        </section>
        <section className="card span-2">
          <h2>Koreksi lengkap dengan AI</h2>
          <p className="muted small">Pemeriksa dasar hanya menangkap pola kesalahan yang sudah dikenal. Untuk kejelasan, kealamian, dan pilihan kata, salin tulisan ini ke Claude.</p>
          <button className="btn secondary" onClick={() => void copyForAi()}>
            Salin untuk Claude
          </button>
        </section>
      </div>
    </div>
  );
}
