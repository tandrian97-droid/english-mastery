import { useLiveQuery } from 'dexie-react-hooks';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { db } from '../db/db';
import { HomePage } from '../features/home/HomePage';
import { LearnPage } from '../features/learn/LearnPage';
import { DayPage } from '../features/learn/DayPage';
import { PracticePage } from '../features/practice/PracticePage';
import { WritingEditor, WritingHome } from '../features/writing/WritingPages';
import { BlockPage } from '../features/learn/BlockPage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { TutorPage } from '../features/tutor/TutorPage';
import { VocabularyPage } from '../features/vocabulary/VocabularyPage';
import { FeedbackProvider } from '../ui/feedback';
import { HomeIcon, LearnIcon, ProgressIcon, TutorIcon, VocabIcon } from '../ui/icons';
import { Onboarding } from './Onboarding';
import { AutoUpdater } from './UpdatePrompt';

const NAV = [
  { to: '/', label: 'Beranda', icon: HomeIcon, end: true },
  { to: '/learn', label: 'Belajar', icon: LearnIcon, also: '/day|/writing|/practice' },
  { to: '/vocabulary', label: 'Kosakata', icon: VocabIcon },
  { to: '/tutor', label: 'AI Tutor', icon: TutorIcon },
  { to: '/progress', label: 'Progres', icon: ProgressIcon },
];

function Shell() {
  const location = useLocation();
  // undefined = masih memuat; null = belum ada profil
  const profile = useLiveQuery(async () => (await db.profile.get(1)) ?? null);
  if (profile === undefined) return null;
  if (profile === null) return <Onboarding />;

  return (
    <div className="app">
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/day/:day" element={<DayPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/writing" element={<WritingHome />} />
          <Route path="/writing/:id" element={<WritingEditor />} />
          <Route path="/day/:day/:block" element={<BlockPage />} />
          <Route path="/vocabulary" element={<VocabularyPage />} />
          <Route path="/tutor" element={<TutorPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      <nav className="nav" aria-label="Navigasi utama">
        {NAV.map(({ to, label, icon: Icon, end, also }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive || (also && also.split('|').some((p) => location.pathname.startsWith(p))) ? 'active' : '')}
          >
            <span className="nav-icon">
              <Icon />
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function App() {
  return (
    <FeedbackProvider>
      <HashRouter>
        <Shell />
        <AutoUpdater />
      </HashRouter>
    </FeedbackProvider>
  );
}
