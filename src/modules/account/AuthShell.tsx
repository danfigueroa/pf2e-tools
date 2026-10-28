import type { ReactNode } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { displayFont, green, parchment } from '../../theme';
import logoHorizontal from '../../assets/covil-logo-horizontal-fundo-escuro.svg';

/** A moldura das telas de entrada (login, convite): verde de fundo, cartão de pergaminho. */
export const AuthShell = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box
    sx={{
      minHeight: '100dvh',
      display: 'grid',
      placeItems: 'center',
      px: 2,
      py: 4,
      backgroundColor: green.main,
    }}
  >
    <Box sx={{ width: '100%', maxWidth: 420 }}>
      <Box component="img" src={logoHorizontal} alt="Covil de Dados" sx={{ display: 'block', height: 44, mx: 'auto', mb: 3 }} />
      <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3.5 }, backgroundColor: parchment.paper, borderRadius: 2 }}>
        <Typography component="h1" sx={{ fontFamily: displayFont, fontSize: '1.4rem', fontWeight: 700, mb: 2 }}>
          {title}
        </Typography>
        {children}
      </Paper>
    </Box>
  </Box>
);
