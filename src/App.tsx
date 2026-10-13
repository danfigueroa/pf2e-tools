import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { pathfinderTheme } from './theme';
import { MainLayout } from './layouts/MainLayout';
import { HomePage } from './pages/HomePage';
import { TransformationPage } from './modules/transformation-statblock/TransformationPage';
import { MonsterScalerPage } from './modules/monster-scaler/MonsterScalerPage';
// MÓDULO DESATIVADO — Ficha em PDF. O código segue em src/modules/character-sheet/
// (e `types.ts` continua sendo usado pelos outros módulos). Para reativar:
// descomente o import e a rota abaixo, e as entradas em MainLayout.tsx e HomePage.tsx.
// import { CharacterSheetPage } from './modules/character-sheet/CharacterSheetPage';
import { CharacterViewerPage } from './modules/character-viewer/CharacterViewerPage';
import { InitiativePage } from './modules/initiative-tracker/InitiativePage';

// Único módulo carregado sob demanda: é o mais pesado de gestos e não serve a
// quem só abre a ficha no celular.
const BattleMapPage = lazy(() => import('./modules/battle-map/BattleMapPage'));

function App() {
  return (
    <ThemeProvider theme={pathfinderTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            {/* Desativado: manda para a Início em vez de deixar a tela em branco
                para quem tiver o link antigo salvo. */}
            <Route path="character-sheet" element={<Navigate to="/" replace />} />
            <Route path="ficha-virtual" element={<CharacterViewerPage />} />
            <Route path="iniciativa" element={<InitiativePage />} />
            <Route path="transformation" element={<TransformationPage />} />
            <Route path="escalar-monstro" element={<MonsterScalerPage />} />
            <Route
              path="mapa/:id?"
              element={<Suspense fallback={null}><BattleMapPage /></Suspense>}
            />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
