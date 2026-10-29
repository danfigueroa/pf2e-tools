import { Box } from '@mui/material';
import { EmojiEvents as TrophyIcon } from '@mui/icons-material';
import { HP_COLOR, gold, ink, parchment, rule } from '../../../../theme';
import { pop } from '../../../../motion/motion';
import { useAnimatedNumber } from '../../../../motion/useAnimatedNumber';
import { useSceneClock } from '../useSceneClock';

// Quantas vezes cada face do d20 saiu numa noite inventada (1 a 20).
const FACES = [3, 5, 4, 6, 5, 7, 4, 6, 8, 5, 6, 7, 5, 6, 4, 7, 5, 6, 4, 9];
const TOP = Math.max(...FACES);
// Vazio → as barras crescem e a média conta → o troféu da noite.
const STEPS = [500, 2300, 3200] as const;

export const HistoryScene = () => {
  const step = useSceneClock(STEPS);
  const grown = step >= 1;
  const mean = useAnimatedNumber(grown ? 114 : 0, { duration: 1200 });

  return (
    <Box sx={{ p: 2, color: ink.primary, display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
        <Box sx={{ fontFamily: '"Cinzel", Georgia, serif', fontWeight: 700, fontSize: '0.9rem' }}>Sessão de sábado</Box>
        <Box sx={{ fontSize: '0.72rem', color: ink.secondary }}>
          Média do d20{' '}
          <Box component="span" sx={{ fontSize: '1.1rem', fontWeight: 800, color: ink.primary, fontVariantNumeric: 'tabular-nums' }}>
            {(mean / 10).toFixed(1).replace('.', ',')}
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 96, px: 0.5, borderBottom: `1px solid ${rule}` }} aria-hidden>
        {FACES.map((n, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: `${(n / TOP) * 100}%`,
              borderRadius: '2px 2px 0 0',
              backgroundColor: i === 19 ? gold.main : i === 0 ? HP_COLOR : `${ink.secondary}66`,
              transformOrigin: 'bottom',
              transform: `scaleY(${grown ? 1 : 0})`,
              transition: grown ? `transform 500ms cubic-bezier(.2,.8,.2,1) ${i * 35}ms` : 'transform 200ms',
            }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: ink.secondary, mt: -1 }} aria-hidden>
        <span>1</span><span>10</span><span>20</span>
      </Box>

      <Box sx={{ minHeight: 48 }}>
        {step === 2 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              p: 1,
              borderRadius: 1.5,
              backgroundColor: parchment.page,
              border: `1px solid ${gold.main}`,
              animation: `${pop} 420ms ease-out`,
            }}
          >
            <TrophyIcon sx={{ color: gold.deep }} />
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ fontSize: '0.8rem', fontWeight: 700 }}>Quem tirou 20 mais vezes</Box>
              <Box sx={{ fontSize: '0.72rem', color: ink.secondary }}>Korvak · 4 vezes nesta sessão</Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
