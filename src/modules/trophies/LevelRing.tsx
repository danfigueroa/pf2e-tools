import { Box, Typography } from '@mui/material';
import { displayFont, gold, green } from '../../theme';
import { useReducedMotion } from '../../motion/motion';
import { EASE, EASE_BACK } from './motion';
import { tr } from '../../i18n';

/**
 * O selo do nível com o anel de progresso em volta (quanto falta para o próximo). O anel enche
 * quando `shown` vira verdadeiro; o número é de quem usa (pode vir contando). `track` é a cor do
 * trilho, que muda com o fundo (moldura verde ou pergaminho).
 */
export function LevelRing({ level, fraction, shown, size = 64, track }: { level: React.ReactNode; fraction: number; shown: boolean; size?: number; track: string }) {
  const reduced = useReducedMotion();
  const stroke = Math.max(3, Math.round(size / 16));
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <Box component="svg" viewBox={`0 0 ${size} ${size}`} aria-hidden sx={{ position: 'absolute', inset: 0, width: size, height: size, rotate: '-90deg' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={gold.bright} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={length} strokeDashoffset={length * (1 - (shown ? f : 0))}
          style={{ transition: reduced ? 'none' : `stroke-dashoffset 1100ms ${EASE} 300ms` }}
        />
      </Box>
      <Box sx={{
        position: 'absolute', inset: stroke + 2, borderRadius: '50%', bgcolor: gold.bright, color: green.deepest, lineHeight: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        transform: shown || reduced ? 'none' : 'scale(0.5)', transition: `transform 700ms ${EASE_BACK}`,
      }}>
        <Typography sx={{ fontSize: size >= 64 ? '0.5625rem' : '0.5rem', fontWeight: 700, letterSpacing: '0.1em' }}>{tr('NÍVEL', 'LEVEL')}</Typography>
        <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: size >= 64 ? '1.5rem' : '1.125rem' }}>{level}</Typography>
      </Box>
    </Box>
  );
}
