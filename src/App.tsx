import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { pathfinderTheme } from './theme';
import { MainLayout } from './layouts/MainLayout';
import { HomePage } from './pages/HomePage';
// Todo módulo é carregado sob demanda. Num bundle só, quem abria a Ficha
// Virtual no celular baixava o html2canvas das exportações, a
// Iniciativa e o Escalar Monstro — mais da metade do JavaScript do site.
const CharacterViewerPage = lazy(() =>
  import('./modules/character-viewer/CharacterViewerPage').then((m) => ({ default: m.CharacterViewerPage })));
const InitiativePage = lazy(() =>
  import('./modules/initiative-tracker/InitiativePage').then((m) => ({ default: m.InitiativePage })));
const TransformationPage = lazy(() =>
  import('./modules/transformation-statblock/TransformationPage').then((m) => ({ default: m.TransformationPage })));
const MonsterScalerPage = lazy(() =>
  import('./modules/monster-scaler/MonsterScalerPage').then((m) => ({ default: m.MonsterScalerPage })));
const BattleMapPage = lazy(() => import('./modules/battle-map/BattleMapPage'));
const SessionDiaryPage = lazy(() =>
  import('./modules/session-diary/SessionDiaryPage').then((m) => ({ default: m.SessionDiaryPage })));

const page = (element: React.ReactNode) => <Suspense fallback={null}>{element}</Suspense>;

function App() {
  return (
    <ThemeProvider theme={pathfinderTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            {/* A Ficha em PDF foi removida: manda para a Início em vez de deixar a
                tela em branco para quem tiver o link antigo salvo. */}
            <Route path="character-sheet" element={<Navigate to="/" replace />} />
            <Route path="ficha-virtual" element={page(<CharacterViewerPage />)} />
            <Route path="iniciativa" element={page(<InitiativePage />)} />
            <Route path="transformation" element={page(<TransformationPage />)} />
            <Route path="escalar-monstro" element={page(<MonsterScalerPage />)} />
            <Route path="mapa/:id?" element={page(<BattleMapPage />)} />
            <Route path="historico" element={page(<SessionDiaryPage />)} />
            {/* O nome antigo ("Diário da Sessão") parecia um diário escrito; o link salvo continua valendo. */}
            <Route path="diario" element={<Navigate to="/historico" replace />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
