import { useEffect, useState } from 'react';
import { Box, ButtonBase, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { chrome, displayFont, gold, green, TROPHY_TIERS } from '../../theme';
import { useReducedMotion } from '../../motion/motion';
import { useAnimatedNumber } from '../../motion/useAnimatedNumber';
import { TIER_POINTS, type TrophyTier } from '../../services/trophies';
import { TrophyMedal } from './TrophyMedal';
import { Sparks } from './Sparks';
import { drop, EASE, pointsUp, ringOut, rise, shine, spinIn } from './motion';

// O cartão "Troféu desbloqueado", no estilo dos consoles (chunk à parte: o `TrophyToastLayer`
// do layout só o baixa quando há o que mostrar). A sequência:
//   1. o cartão desce do topo;
//   2. a taça entra girando no próprio eixo e assenta (passa um pouco do tamanho e volta);
//   3. faíscas na cor do grau explodem atrás dela (canvas), e um brilho atravessa a medalha;
//   4. os pontos contam até o valor do grau ("+90 pts") e sobem;
//   5. platina: duas levas de faíscas e dois anéis dourados se abrindo, e o cartão fica mais.
// Movimento reduzido: o cartão aparece pronto, sem nada disso.

export interface UnlockToast { key: string; title: string; tier: TrophyTier }

const MEDAL = 56;

export default function TrophyUnlockCard({ toast, leaving, onOpen, onClose }: { toast: UnlockToast; leaving: boolean; onOpen: () => void; onClose: () => void }) {
  const reduced = useReducedMotion();
  const tier = TROPHY_TIERS[toast.tier];
  const platinum = toast.tier === 'platina';
  const points = TIER_POINTS[toast.tier];
  // Os pontos contam só depois de a taça assentar.
  const [counting, setCounting] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setCounting(true), 750);
    return () => clearTimeout(t);
  }, [reduced]);
  const shown = useAnimatedNumber(counting ? points : 0, { duration: 700 });

  const motion = (value: string) => (reduced ? 'none' : value);
  return (
    <Box role="status" aria-live="polite" aria-label={`Troféu desbloqueado: ${toast.title} (${tier.label})`} sx={{
      position: 'fixed', top: { xs: 72, md: 16 }, left: { xs: '50%', md: 'calc(50% + var(--sidebar-w, 0px) / 2)' },
      transform: 'translate(-50%, 0)', zIndex: 1260, width: 'min(400px, calc(100vw - 24px))', boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', gap: 1.75, p: 1.5, pr: 0.5, borderRadius: 2.5, overflow: 'visible',
      bgcolor: green.deepest, color: chrome.text,
      boxShadow: `0 0 0 2px ${tier.medal}, 0 16px 40px rgba(0,0,0,.4)`,
      animation: motion(leaving ? `${rise} 260ms ease-in forwards` : `${drop} 520ms ${EASE}`),
    }}>
      <ButtonBase onClick={onOpen} sx={{ flex: 1, minWidth: 0, display: 'flex', gap: 1.75, justifyContent: 'flex-start', textAlign: 'left', borderRadius: 1.5 }}>
        {/* A taça, com o que acontece em volta dela. */}
        <Box sx={{ position: 'relative', width: MEDAL, height: MEDAL, flexShrink: 0 }}>
          {!reduced && platinum && [0, 1].map((i) => (
            <Box key={i} aria-hidden sx={{
              position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${gold.bright}`,
              animation: `${ringOut} 1100ms ${EASE} ${700 + i * 380}ms both`,
            }} />
          ))}
          {!reduced && (
            <Sparks
              colors={platinum ? [gold.bright, tier.medal, chrome.text] : [tier.medal, gold.bright, chrome.text]}
              count={platinum ? 46 : toast.tier === 'ouro' ? 34 : 24}
              bursts={platinum ? 2 : 1}
              size={220}
              delay={620}
            />
          )}
          <Box sx={{ position: 'relative', width: MEDAL, height: MEDAL, borderRadius: '50%', overflow: 'hidden', animation: motion(`${spinIn} 900ms ${EASE} 120ms both`) }}>
            <TrophyMedal tier={toast.tier} size={MEDAL} />
            {!reduced && (
              <Box aria-hidden sx={{
                position: 'absolute', inset: 0, width: '45%',
                background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.85) 50%, rgba(255,255,255,0) 100%)',
                animation: `${shine} 800ms ease-out 980ms both`,
              }} />
            )}
          </Box>
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', color: gold.bright }}>
            {platinum ? 'PLATINA CONQUISTADA' : 'TROFÉU DESBLOQUEADO'} · {tier.label.toUpperCase()}
          </Typography>
          <Typography noWrap sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.0625rem' }}>{toast.title}</Typography>
          <Typography sx={{
            fontSize: '0.8125rem', fontWeight: 700, color: chrome.textSoft, fontVariantNumeric: 'tabular-nums',
            animation: motion(`${pointsUp} 2600ms ease-out 700ms both`),
          }}>
            +{shown} pts
          </Typography>
        </Box>
      </ButtonBase>
      <IconButton size="small" aria-label="Fechar" onClick={onClose} sx={{ color: chrome.textMuted, alignSelf: 'flex-start' }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
