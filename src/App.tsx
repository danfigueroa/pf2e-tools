import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { pathfinderTheme } from './theme';
import { MainLayout } from './layouts/MainLayout';
import { HomePage } from './pages/HomePage';
import { TransformationPage } from './modules/transformation-statblock/TransformationPage';
import { CharacterSheetPage } from './modules/character-sheet/CharacterSheetPage';

function App() {
  return (
    <ThemeProvider theme={pathfinderTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="character-sheet" element={<CharacterSheetPage />} />
            <Route path="transformation" element={<TransformationPage />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
