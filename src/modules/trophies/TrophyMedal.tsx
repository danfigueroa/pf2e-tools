import { Box } from '@mui/material';
import { chrome, ink, parchment, TROPHY_TIERS } from '../../theme';
import type { TrophyTier } from '../../services/trophies';

/**
 * A taça do troféu, desenhada em SVG (sem imagem): a cor é a do grau, e o bloqueado é só o
 * contorno. O grau também vai por extenso ao lado, em quem usa — cor não pode ser o único sinal.
 */
export function TrophyMedal({ tier, locked, size = 56 }: { tier: TrophyTier; locked?: boolean; size?: number }) {
  const c = TROPHY_TIERS[tier];
  const fill = locked ? parchment.sunken : c.medal;
  const line = locked ? ink.disabled : c.ink;
  return (
    <Box component="svg" viewBox="0 0 48 48" aria-hidden sx={{ width: size, height: size, flexShrink: 0, display: 'block' }}>
      <circle cx="24" cy="24" r="22" fill={locked ? parchment.page : c.tint} stroke={line} strokeWidth="1.5" strokeDasharray={locked ? '3 3' : undefined} />
      {/* Taça: copo, alças, haste e base. */}
      <path d="M16 13h16v6a8 8 0 0 1-16 0z" fill={fill} stroke={line} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M16 15h-3a4 4 0 0 0 4 5M32 15h3a4 4 0 0 1-4 5" fill="none" stroke={line} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M24 27v5M19 36h10M20.5 32h7l1.5 4h-10z" fill={fill} stroke={line} strokeWidth="1.4" strokeLinejoin="round" />
      {tier === 'platina' && !locked && <path d="M24 16l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill={chrome.onAccent} />}
      {locked && <path d="M21 21v-2a3 3 0 0 1 6 0v2M20 21h8v5h-8z" fill="none" stroke={line} strokeWidth="1.3" strokeLinejoin="round" />}
    </Box>
  );
}
