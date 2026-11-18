import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../db/db';
import { getDashboardStats, isBackupOverdue, TOTAL_CURRICULUM_DAYS } from '../../db/repo';
import { SKILL_LABELS, SKILLS } from '../../db/schema';
import { formatMinutes, greeting, shortDayName, toLocalDate } from '../../engine/dates';
import { formatClock, useStudyTimer } from '../../engine/useStudyTimer';
import { useFeedback } from '../../ui/feedback';
import { GearIcon, PauseIcon, PlayIcon } from '../../ui/icons';
import { useOnline } from '../../ui/hooks';

const STOP_MESSAGES = {
  idle: 'Timer dijeda otomatis karena 10 menit tidak ada aktivitas.',
  hidden: 'Timer dijeda karena aplikasi ditutup atau layar mati.',
  user: '',
} as const;

export function HomePage() {
  const { reportError } = useFeedback();
  const timer = useStudyTimer(reportError);
  const online = useOnline();
  const profile = useLiveQuery(() => db.profile.get(1));
  const settings = useLiveQuery(() => db.settings.get(1));
  // daily_log dibaca agar statistik ikut berubah setiap kali timer menyimpan
  const stats = useLiveQuery(async () => {
    await db.daily_log.count();
    return getDashboardStats();
  });

  if (!profile || !stats) return <div className="page" aria-busy="true" />;

  const targetSeconds = profile.dailyTargetMinutes * 60;
  // Total hari ini = yang sudah tersimpan + detik terakhir yang belum sempat disimpan.
  const todaySeconds = stats.todaySeconds + timer.unsavedSeconds;
  const pct = Math.min(100, Math.round((todaySeconds / targetSeconds) * 100));
  const weekMax = Math.max(targetSeconds, ...stats.week.map((d) => d.seconds));
  const today = toLocalDate();
  const backupOverdue = settings ? isBackupOverdue(profile, settings) : false;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>
            {greeting()}, {profile.name}
          </h1>
          <p className="sub">
            Hari {profile.curriculumDay} dari {TOTAL_CURRICULUM_DAYS} · {online ? 'online' : 'offline — semua fitur inti tetap jalan'}
          </p>
        </div>
        <Link to="/settings" className="icon-btn" aria-label="Pengaturan">
          <GearIcon />
        </Link>
      </header>

      {backupOverdue && (
        <div className="banner warn">
          <span>Sudah lebih dari {settings?.backupReminderDays} hari tanpa backup. Data hanya tersimpan di HP ini.</span>
          <Link to="/settings" className="btn secondary">
            Backup sekarang
          </Link>
        </div>
      )}

      <div className="grid two">
        <section className="card hero">
          <div className="row between">
            <h2>Target hari ini</h2>
            <span className="muted small">
              {formatMinutes(todaySeconds)} / {profile.dailyTargetMinutes} mnt
            </span>
          </div>
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="muted small">
            {pct >= 100
              ? 'Target 120 menit tercapai. Hebat.'
              : todaySeconds >= profile.minimumDayMinutes * 60
                ? 'Minimum 30 menit tercapai, streak aman. Lanjutkan kapan pun sempat.'
                : 'Belajar boleh dipecah: 10–15 menit sekali, jeda kapan saja.'}
          </p>
          <div className="row between">
            <div className="stack" style={{ gap: 0 }}>
              <div className="timer" aria-live="off">
                {formatClock(todaySeconds)}
              </div>
              <span className="muted small">total hari ini</span>
            </div>
            {timer.running ? (
              <button className="btn light" onClick={() => timer.stop('user')}>
                <PauseIcon /> Jeda
              </button>
            ) : (
              <button className="btn" onClick={timer.start}>
                <PlayIcon /> {todaySeconds > 0 ? 'Lanjutkan' : 'Mulai belajar'}
              </button>
            )}
          </div>
          {timer.lastStop && timer.lastStop !== 'user' && <p className="muted small">{STOP_MESSAGES[timer.lastStop]}</p>}
          <p className="muted small">
            Timer ini menghitung waktu belajar aktif. Mulai Tahap 2, timer berjalan otomatis di dalam setiap pelajaran.
          </p>
        </section>

        <section className="card">
          <h2>Pelajaran hari ini</h2>
          <p className="muted">
            Materi bulan 1 (bunyi & ejaan, 300 kata pertama, <i>to be</i>, simple present) sedang dibuat dan masuk di Tahap 2.
          </p>
          <Link to="/learn" className="btn secondary block">
            Lihat kurikulum 10 bulan
          </Link>
        </section>

        <section className="card span-2">
          <div className="stats">
            <div className="stat">
              <div className="label">Streak</div>
              <div className="value">{stats.streak} hari</div>
              <div className="hint">min. {profile.minimumDayMinutes} mnt/hari</div>
            </div>
            <div className="stat">
              <div className="label">Total belajar</div>
              <div className="value">{formatMinutes(stats.totalSeconds)}</div>
              <div className="hint">{stats.daysStudied} hari belajar</div>
            </div>
            <div className="stat">
              <div className="label">Kosakata aktif</div>
              <div className="value">{stats.vocabActive}</div>
              <div className="hint">dari {stats.vocabTotal} kata dikenal</div>
            </div>
            <div className="stat">
              <div className="label">Review jatuh tempo</div>
              <div className="value">{stats.vocabDue}</div>
              <div className="hint">kartu kosakata</div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="row between">
            <h2>7 hari terakhir</h2>
            <span className="muted small">menit / hari</span>
          </div>
          <div className="week" aria-label="Menit belajar 7 hari terakhir">
            {stats.week.map((d) => {
              const h = Math.round((d.seconds / weekMax) * 100);
              const cls = d.seconds === 0 ? 'empty' : d.date === today ? 'today' : '';
              return (
                <div className="bar" key={d.date} title={`${d.date}: ${formatMinutes(d.seconds)}`}>
                  <span className="val">{d.seconds >= 60 ? Math.round(d.seconds / 60) : ''}</span>
                  <span className={`fill ${cls}`} style={{ height: `${Math.max(h, 3)}%` }} />
                  <small>{shortDayName(d.date)}</small>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2>Level saat ini (estimasi)</h2>
          <table className="table">
            <tbody>
              {SKILLS.map((s) => (
                <tr key={s}>
                  <td>{SKILL_LABELS[s]}</td>
                  <td>
                    <span className="badge">{profile.levels[s] === 'PreA1' ? 'Pre-A1' : profile.levels[s]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Level hanya naik dari hasil asesmen, bukan dari jumlah pelajaran yang selesai.</p>
        </section>
      </div>
    </div>
  );
}
