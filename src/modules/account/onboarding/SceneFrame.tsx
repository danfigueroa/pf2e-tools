import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { HP_COLOR, chrome, gold, green, parchment } from '../../../theme';

/** A "janela" de app em miniatura onde cada cena é desenhada. */
export const SceneFrame = ({ label, dark = false, children }: { label: string; dark?: boolean; children: ReactNode }) => (
  <Box
    sx={{
      width: '100%',
      borderRadius: 2.5,
      overflow: 'hidden',
      border: `1px solid ${gold.main}55`,
      boxShadow: `0 24px 48px -20px #00000099, 0 0 0 1px ${green.deepest}`,
      backgroundColor: dark ? chrome.raised : parchment.paper,
    }}
  >
    <Box
      aria-hidden
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.5,
        height: 28,
        backgroundColor: green.deepest,
        borderBottom: `1px solid ${gold.main}44`,
      }}
    >
      {[HP_COLOR, gold.bright, chrome.online].map((c) => (
        <Box key={c} sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c, opacity: 0.85 }} />
      ))}
      <Box sx={{ ml: 1, fontSize: '0.7rem', letterSpacing: '0.08em', color: chrome.textMuted, textTransform: 'uppercase' }}>
        {label}
      </Box>
    </Box>
    <Box sx={{ position: 'relative', height: { xs: 248, sm: 260 }, overflow: 'hidden' }}>{children}</Box>
  </Box>
);

/** Círculo com iniciais — token, avatar de quem rolou. */
export const Initials = ({ text, color, size = 28 }: { text: string; color: string; size?: number }) => (
  <Box
    sx={{
      width: size,
      height: size,
      flex: '0 0 auto',
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      backgroundColor: color,
      color: chrome.onAccent,
      fontWeight: 700,
      fontSize: size * 0.4,
      boxShadow: `0 0 0 2px ${parchment.paper}`,
    }}
  >
    {text}
  </Box>
);
