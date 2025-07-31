import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { darkTheme } from './theme';
import { MainLayout } from './layouts/MainLayout';
import { HomePage } from './pages/HomePage';
import { TransformationPage } from './modules/transformation-statblock/TransformationPage';

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="transformation" element={<TransformationPage />} />
            <Route path="settings" element={
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <h2>Configurações</h2>
                <p>Em desenvolvimento...</p>
              </div>
            } />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
