import { memo, useEffect, useState } from 'react';
import { Box, ButtonBase, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { keyframes } from '@emotion/react';
import { chrome, displayFont, gold, green, TROPHY_TIERS } from '../theme';
import { onTableEvent } from '../services/notifications';
import { getAuthState } from '../services/auth';
import { TrophyMedal } from '../modules/trophies/TrophyMedal';
import type { TrophyTier } from '../services/trophies';

// "Troféu desbloqueado", no estilo dos consoles: um cartão que desce no topo da tela quando
// chega um `trophy-unlocked` desta conta pelo canal de eventos da mesa, em qualquer página.
// Montado UMA vez no `MainLayout`. Vários de uma vez (encerrar a sessão dá alguns) entram em
// fila, um por vez. O troféu já está gravado: o cartão só apresenta.

const SHOW_MS = 6000;
const TIERS: TrophyTier[] = ['bronze', 'prata', 'ouro', 'platina'];

const drop = keyframes`
  from { transform: translate(-50%, -24px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
`;

interface Toast { key: string; title: string; tier: TrophyTier }

export const TrophyToastLayer = memo(function TrophyToastLayer() {
  const [queue, setQueue] = useState<Toast[]>([]);
  const navigate = useNavigate();

  useEffect(() => onTableEvent((kind, data) => {
    if (kind !== 'trophy-unlocked') return;
    const auth = getAuthState();
    if (auth.status !== 'in' || data.user !== auth.user.id) return;
    const tier = TIERS.includes(data.tier as TrophyTier) ? (data.tier as TrophyTier) : 'bronze';
    setQueue((q) => [...q, { key: `${String(data.trophy)}-${Date.now()}`, title: String(data.title ?? 'Troféu'), tier }]);
  }), []);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;
  const tier = TROPHY_TIERS[current.tier];
  return (
    <Box key={current.key} role="status" aria-live="polite" sx={{
      position: 'fixed', top: { xs: 72, md: 16 }, left: { xs: '50%', md: 'calc(50% + var(--sidebar-w, 0px) / 2)' }, transform: 'translate(-50%, 0)',
      zIndex: 1260, width: 'min(380px, calc(100vw - 24px))', boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, pr: 0.5, borderRadius: 2.5,
      bgcolor: green.deepest, color: chrome.text, boxShadow: `0 0 0 2px ${tier.medal}, 0 14px 36px rgba(0,0,0,.35)`,
      animation: `${drop} 320ms ease-out`, '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
    }}>
      <ButtonBase onClick={() => { setQueue((q) => q.slice(1)); navigate('/trofeus'); }} sx={{ flex: 1, minWidth: 0, display: 'flex', gap: 1.5, justifyContent: 'flex-start', textAlign: 'left', borderRadius: 1.5 }}>
        <TrophyMedal tier={current.tier} size={48} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', color: gold.bright }}>
            TROFÉU DESBLOQUEADO · {tier.label.toUpperCase()}
          </Typography>
          <Typography noWrap sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.0625rem' }}>{current.title}</Typography>
        </Box>
      </ButtonBase>
      <IconButton size="small" aria-label="Fechar" onClick={() => setQueue((q) => q.slice(1))} sx={{ color: chrome.textMuted }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
});
