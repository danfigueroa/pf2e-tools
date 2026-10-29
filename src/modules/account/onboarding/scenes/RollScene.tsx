import { keyframes } from '@emotion/react';
import { Box } from '@mui/material';
import { DiceTray } from '../../../../motion/DiceTray';
import { MAGUS_COLOR, RAGE_COLOR, chrome, gold, green } from '../../../../theme';
import { useSceneClock } from '../useSceneClock';
import { Initials } from '../SceneFrame';

// Três rolagens de gente diferente, uma depois da outra — os números já vêm "sorteados".
const ROLLS = [
  { who: 'Seraphine', initials: 'SE', color: green.light, label: 'Vontade', d20: 20, mod: 15 },
  { who: 'Bruma', initials: 'BR', color: MAGUS_COLOR, label: 'Golpe · Rapieira', d20: 14, mod: 17 },
  { who: 'Korvak', initials: 'KO', color: RAGE_COLOR, label: 'Atletismo', d20: 9, mod: 16 },
] as const;
const STEPS = [3400, 3400, 3400] as const;

const slideIn = keyframes`
  0% { opacity: 0; transform: translateY(24px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

export const RollScene = () => {
  const step = useSceneClock(STEPS);
  const roll = ROLLS[step];
  const total = roll.d20 + roll.mod;

  return (
    <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', px: 2 }}>
      <Box
        key={step}
        sx={{
          width: '100%',
          maxWidth: 300,
          p: 1.75,
          borderRadius: 2,
          backgroundColor: chrome.hero,
          border: `1px solid ${chrome.lineStrong}`,
          color: chrome.text,
          boxShadow: '0 16px 32px -12px #000000AA',
          animation: `${slideIn} 380ms cubic-bezier(.2,.8,.2,1)`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Initials text={roll.initials} color={roll.color} size={26} />
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{roll.who}</Box>
            <Box sx={{ fontSize: '0.72rem', color: chrome.textMuted }}>{roll.label}</Box>
          </Box>
        </Box>
        <DiceTray dice={[{ faces: 20, value: roll.d20 }]} flat={roll.mod} total={total} color={roll.color} compact />
        <Box sx={{ mt: 1, textAlign: 'center', fontSize: '0.72rem', color: chrome.textSoft, fontVariantNumeric: 'tabular-nums' }}>
          d20 {roll.d20} + {roll.mod} = {total}
        </Box>
      </Box>

      <Box
        sx={{
          position: 'absolute',
          bottom: 10,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 0.75,
          fontSize: '0.7rem',
          color: chrome.textMuted,
        }}
      >
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: chrome.online }} />
        Na tela dos <Box component="span" sx={{ color: gold.bright, fontWeight: 700 }}>5</Box> da mesa
      </Box>
    </Box>
  );
};
