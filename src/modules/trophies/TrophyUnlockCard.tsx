import { useEffect, useMemo, useState } from 'react';
import { Box, ButtonBase, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { chrome, displayFont, gold, green, TROPHY_TIERS } from '../../theme';
import { useReducedMotion } from '../../motion/motion';
import { useAnimatedNumber } from '../../motion/useAnimatedNumber';
import { TIER_POINTS, type TrophyTier } from '../../services/trophies';
import { TrophyMedal } from './TrophyMedal';
import { Sparks } from './Sparks';
import { drop, EASE, pointsUp, rise, shine, spinIn, sweep, timeLeft } from './motion';
import { tr } from '../../i18n';

// A FAIXA "Troféu desbloqueado", no topo (chunk à parte: o `TrophyToastLayer` só a baixa quando
// há o que mostrar). É o aviso que não tapa a tela: o bronze e a prata de um colega, e qualquer
// troféu quando a pessoa está digitando. O resto vai para a `TrophyCeremony`, em tela cheia.
//   1. a faixa desce do topo e um brilho a percorre de ponta a ponta;
//   2. a medalha entra girando no próprio eixo e assenta (passa um pouco do tamanho e volta);
//   3. faíscas na cor do grau explodem atrás dela (canvas), e um brilho atravessa a medalha;
//   4. os pontos contam até o valor do grau ("+90 pts");
//   5. a barra de baixo mostra o tempo que resta.
// Movimento reduzido: a faixa aparece pronta, sem nada disso.

/** `who` = quem ganhou, quando não é esta conta (o anúncio vai a toda a mesa). */
export interface UnlockToast {
  key: string; title: string; tier: TrophyTier; who: string | null
  /** O que desbloqueou o troféu ("Tire dois 20 naturais seguidos na mesma sessão."); vazio no aviso antigo. */
  description: string
  /** Escolhe o glifo da medalha; `null` no aviso antigo (taça). */
  category: string | null
  /** Os pontos da conta ANTES deste troféu (só no meu, ao vivo): liga o ato do nível na cerimônia. */
  pointsBefore?: number | null
  /** Vários troféus ganhos com o app fechado, numa cerimônia só. */
  bundle?: { title: string; tier: TrophyTier; category: string | null }[]
}

const MEDAL = { xs: 56, sm: 68 };

export default function TrophyUnlockCard({ toast, leaving, duration, onOpen, onClose }: { toast: UnlockToast; leaving: boolean; duration?: number; onOpen: () => void; onClose: () => void }) {
  const reduced = useReducedMotion();
  const tier = TROPHY_TIERS[toast.tier];
  const platinum = toast.tier === 'platina';
  const points = TIER_POINTS[toast.tier];
  // Os pontos contam só depois de a medalha assentar.
  const [counting, setCounting] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setCounting(true), 750);
    return () => clearTimeout(t);
  }, [reduced]);
  const shown = useAnimatedNumber(counting ? points : 0, { duration: 700 });
  const colors = useMemo(() => [tier.medal, tier.hi, gold.bright, chrome.text], [tier]);

  const motion = (value: string) => (reduced ? 'none' : value);
  return (
    <Box role="status" aria-live="polite" aria-label={`${toast.who ? tr(`${toast.who} desbloqueou`, `${toast.who} unlocked`) : tr('Troféu desbloqueado', 'Trophy unlocked')}: ${toast.title} (${tier.label})${toast.description ? `. ${toast.description}` : ''}`} sx={{
      position: 'fixed', top: { xs: 72, md: 16 }, left: { xs: '50%', md: 'calc(50% + var(--sidebar-w, 0px) / 2)' },
      transform: 'translate(-50%, 0)', zIndex: 1260, width: 'min(460px, calc(100vw - 24px))', boxSizing: 'border-box',
      borderRadius: 3, bgcolor: green.deepest, color: chrome.text,
      boxShadow: `0 0 0 2px ${tier.medal}, 0 0 28px 2px ${tier.medal}73, 0 18px 44px rgba(0,0,0,.45)`,
      animation: motion(leaving ? `${rise} 260ms ease-in forwards` : `${drop} 520ms ${EASE}`),
    }}>
      {/* O que precisa ser cortado pela borda arredondada (as faíscas, não: elas saem da faixa). */}
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, borderRadius: 3, overflow: 'hidden', pointerEvents: 'none' }}>
        {!reduced && (
          <Box sx={{
            position: 'absolute', top: 0, bottom: 0, left: 0, width: '30%',
            background: `linear-gradient(90deg, ${tier.hi}00 0%, ${tier.hi}40 50%, ${tier.hi}00 100%)`,
            animation: `${sweep} 1100ms ease-out 420ms both`,
          }} />
        )}
        {duration && !reduced && (
          <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, bgcolor: tier.medal, transformOrigin: 'left center', animation: `${timeLeft} ${duration}ms linear forwards` }} />
        )}
      </Box>
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.75, p: 1.75, pr: 0.5 }}>
        <ButtonBase onClick={onOpen} sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.75, justifyContent: 'flex-start', textAlign: 'left', borderRadius: 1.5 }}>
          {/* A medalha, com o que acontece em volta dela. */}
          <Box sx={{ position: 'relative', width: MEDAL, height: MEDAL, flexShrink: 0 }}>
            {!reduced && <Sparks colors={colors} count={platinum ? 46 : toast.tier === 'ouro' ? 34 : 24} bursts={platinum ? 2 : 1} size={240} delay={620} />}
            <Box sx={{ position: 'relative', width: '100%', height: '100%', '& > svg': { width: '100%', height: '100%' }, animation: motion(`${spinIn} 900ms ${EASE} 120ms both`) }}>
              <TrophyMedal tier={toast.tier} category={toast.category} size={68} />
              {!reduced && (
                <Box aria-hidden sx={{ position: 'absolute', inset: 0, clipPath: 'circle(34%)', overflow: 'hidden' }}>
                  <Box sx={{
                    position: 'absolute', top: 0, bottom: 0, left: 0, width: '45%',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.85) 50%, rgba(255,255,255,0) 100%)',
                    animation: `${shine} 800ms ease-out 980ms both`,
                  }} />
                </Box>
              )}
            </Box>
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', color: gold.bright }}>
              {toast.who ? tr(`${toast.who.toUpperCase()} DESBLOQUEOU`, `${toast.who.toUpperCase()} UNLOCKED`) : platinum ? tr('PLATINA CONQUISTADA', 'PLATINUM EARNED') : tr('TROFÉU DESBLOQUEADO', 'TROPHY UNLOCKED')} · {tier.label.toUpperCase()}
            </Typography>
            <Typography noWrap sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.1875rem', lineHeight: 1.25 }}>{toast.title}</Typography>
            {toast.description && (
              <Typography sx={{
                fontSize: '0.8125rem', lineHeight: 1.35, color: chrome.textSoft, mb: 0.25,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {toast.description}
              </Typography>
            )}
            <Typography sx={{
              fontSize: '0.875rem', fontWeight: 700, color: gold.bright, fontVariantNumeric: 'tabular-nums',
              animation: motion(`${pointsUp} 700ms ease-out 700ms both`),
            }}>
              +{shown} pts
            </Typography>
          </Box>
        </ButtonBase>
        <IconButton size="small" aria-label={tr("Fechar", 'Close')} onClick={onClose} sx={{ color: chrome.textMuted, alignSelf: 'flex-start' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
