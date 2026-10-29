import { Box } from '@mui/material';
import { CONDITION_COLOR, HP_COLOR, TRADITION_COLORS, chrome, gold, green, ink, parchment, rule, status } from '../../../../theme';
import { SPEND, floatUp, pop, pulseAnimation, useReducedMotion } from '../../../../motion/motion';
import { useAnimatedNumber } from '../../../../motion/useAnimatedNumber';
import { useSceneClock } from '../useSceneClock';
import { Initials } from '../SceneFrame';

// Parada → toma 9 de dano → fica Amedrontado → gasta um slot → é curada.
const STEPS = [1100, 1500, 1400, 1400, 1700] as const;
const MAX = 72;

export const SheetScene = () => {
  const step = useSceneClock(STEPS);
  const reduced = useReducedMotion();
  const hurt = step >= 1 && step <= 3;
  const hp = useAnimatedNumber(hurt ? 49 : 58);
  const pulse = step === 1 ? pulseAnimation({ kind: 'hurt', id: 1 }) : step === 4 ? pulseAnimation({ kind: 'heal', id: 2 }) : undefined;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 }, display: 'grid', gap: { xs: 1.25, sm: 1.5 }, color: ink.primary }}>
      <Box sx={{ display: 'flex', gap: 0.75 }} aria-hidden>
        {['Visão Geral', 'Combate', 'Magias'].map((t, i) => (
          <Box
            key={t}
            sx={{
              px: 1.25,
              py: 0.25,
              fontSize: '0.7rem',
              borderRadius: 5,
              border: `1px solid ${i === 0 ? gold.main : rule}`,
              color: i === 0 ? gold.deep : ink.secondary,
              fontWeight: i === 0 ? 700 : 400,
            }}
          >
            {t}
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Initials text="SE" color={green.light} size={36} />
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: '"Cinzel", Georgia, serif' }}>Seraphine</Box>
          <Box sx={{ fontSize: '0.72rem', color: ink.secondary }}>Clériga 7 · Humana</Box>
        </Box>
      </Box>

      <Box sx={{ position: 'relative', p: 1.25, borderRadius: 1.5, backgroundColor: parchment.page, animation: pulse }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
          <Box sx={{ fontSize: '0.7rem', letterSpacing: '0.08em', color: ink.secondary, fontWeight: 700 }}>PONTOS DE VIDA</Box>
          <Box sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
            <Box component="span" sx={{ fontSize: '1.15rem', color: hurt ? HP_COLOR : ink.primary, transition: 'color 300ms' }}>{hp}</Box>
            <Box component="span" sx={{ fontSize: '0.8rem', color: ink.secondary }}> / {MAX}</Box>
          </Box>
        </Box>
        <Box sx={{ height: 8, borderRadius: 4, backgroundColor: parchment.sunken, overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              backgroundColor: hurt ? HP_COLOR : status.success,
              transformOrigin: 'left',
              transform: `scaleX(${(hurt ? 49 : 58) / MAX})`,
              transition: 'transform 600ms cubic-bezier(.2,.8,.2,1), background-color 300ms',
            }}
          />
        </Box>
        {!reduced && (step === 1 || step === 4) && (
          <Box
            key={step}
            aria-hidden
            sx={{
              position: 'absolute',
              right: 64,
              top: 6,
              fontWeight: 800,
              color: step === 1 ? HP_COLOR : status.success,
              animation: `${floatUp} 1200ms ease-out forwards`,
            }}
          >
            {step === 1 ? '−9' : '+9'}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 26, flexWrap: 'wrap' }}>
        <Box sx={{ fontSize: '0.7rem', color: ink.secondary, fontWeight: 700, letterSpacing: '0.08em' }}>CONDIÇÕES</Box>
        {step >= 2 ? (
          <Box
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 5,
              fontSize: '0.75rem',
              fontWeight: 700,
              color: chrome.onAccent,
              backgroundColor: CONDITION_COLOR,
              animation: `${pop} 380ms ease-out`,
            }}
          >
            Amedrontado 1
          </Box>
        ) : (
          <Box sx={{ fontSize: '0.75rem', color: ink.disabled }}>nenhuma</Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ fontSize: '0.7rem', color: ink.secondary, fontWeight: 700, letterSpacing: '0.08em' }}>MAGIAS DE 3º</Box>
        {[0, 1, 2].map((i) => {
          const spent = i === 0 && step >= 3;
          return (
            <Box
              key={i}
              sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: `2px solid ${TRADITION_COLORS.divine}`,
                backgroundColor: spent ? 'transparent' : TRADITION_COLORS.divine,
                transition: 'background-color 250ms',
                animation: spent ? `${SPEND[0]} 380ms ease-out` : undefined,
              }}
            />
          );
        })}
        <Box sx={{ fontSize: '0.72rem', color: ink.secondary, ml: 0.5 }}>{step >= 3 ? 'Heal conjurada' : ''}</Box>
      </Box>
    </Box>
  );
};
