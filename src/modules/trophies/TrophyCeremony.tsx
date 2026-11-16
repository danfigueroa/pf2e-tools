import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { chrome, displayFont, gold, green, TROPHY_TIERS } from '../../theme';
import { pop, useReducedMotion } from '../../motion/motion';
import { useAnimatedNumber } from '../../motion/useAnimatedNumber';
import { levelOf, TIER_POINTS } from '../../services/trophies';
import { TrophyMedal } from './TrophyMedal';
import { Sparks } from './Sparks';
import type { UnlockToast } from './TrophyUnlockCard';
import {
  barFill, EASE, EASE_BACK, EASE_SPIN, haloBreathe, lineIn, medalFloat, medalLand, medalTurn, raysTurn, ringOut, shine, timeLeft, veilIn, veilOut,
} from './motion';
import { tr } from '../../i18n';

// A cerimônia do desbloqueio, em tela cheia (chunk à parte, baixado ocioso pelo `TrophyToastLayer`;
// a página de troféus usa a mesma para rever um troféu). A sequência:
//   1. o véu escurece a tela e os raios começam a girar atrás do palco;
//   2. a medalha entra girando de longe e assenta; um brilho a atravessa;
//   3. o confete explode de trás dela (um canvas só, de tela cheia);
//   4. o texto sobe em cascata: quem ganhou e o grau, o título, o que desbloqueou, os pontos;
//   5. no MEU troféu ao vivo, a barra do nível enche — e, se o nível subiu, ela completa, o selo
//      estoura e troca para o nível novo;
//   6. platina: mais confete, em duas levas, e anéis se abrindo.
// O troféu já está gravado quando isto roda: fechar (toque em qualquer lugar, Esc, o tempo) não
// muda nada. O FOCO NÃO É ROUBADO — quem está digitando segue digitando (e quem tem o foco num
// campo nem recebe a cerimônia: o layer manda a faixa). Movimento reduzido: o cartão pronto.

interface Props {
  toast: UnlockToast;
  leaving: boolean;
  /** Tempo até fechar sozinha (ms): desenha a barra do tempo. Sem ele (reprise), fica até fechar. */
  duration?: number;
  /** Quantos ainda esperam na fila. */
  waiting?: number;
  onOpen?: () => void;
  onClose: () => void;
}

/** A barra do nível: enche até o ponto novo; se o nível subiu, completa e recomeça no nível novo. */
function LevelAct({ before, gained, reduced }: { before: number; gained: number; reduced: boolean }) {
  const from = levelOf(before);
  const to = levelOf(before + gained);
  const up = to.level > from.level;
  // 0 = espera o texto; 1 = enche no nível antigo; 2 = (subiu) recomeça no nível novo.
  const [phase, setPhase] = useState(reduced ? (up ? 2 : 1) : 0);
  useEffect(() => {
    if (reduced) return;
    const timers = [window.setTimeout(() => setPhase(1), 1900)];
    if (up) timers.push(window.setTimeout(() => setPhase(2), 2900));
    return () => timers.forEach((t) => clearTimeout(t));
  }, [reduced, up]);

  const level = phase === 2 ? to.level : from.level;
  const start = phase === 2 ? 0 : from.into / from.next;
  const end = phase === 0 ? start : phase === 2 ? to.into / to.next : up ? 1 : to.into / to.next;
  const leveled = up && phase === 2;
  return (
    <Box sx={{ width: '100%', maxWidth: 340, display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, animation: reduced ? 'none' : `${lineIn} 500ms ${EASE} 1500ms both` }}>
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        {leveled && !reduced && (
          <Box aria-hidden sx={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${gold.bright}`, animation: `${ringOut} 900ms ${EASE} both` }} />
        )}
        <Box key={level} sx={{
          position: 'relative', width: 52, height: 52, borderRadius: '50%', bgcolor: gold.bright, color: green.deepest, lineHeight: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          animation: leveled && !reduced ? `${pop} 520ms ${EASE}` : 'none',
        }}>
          <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em' }}>{tr('NÍVEL', 'LEVEL')}</Typography>
          <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.375rem' }}>{level}</Typography>
        </Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: leveled ? gold.bright : chrome.textSoft, mb: 0.5 }}>
          {leveled
            ? tr(`Você subiu para o nível ${to.level}!`, `You reached level ${to.level}!`)
            : up ? tr('Subindo de nível…', 'Leveling up…')
              : tr(`Faltam ${to.next - to.into} pts para o nível ${to.level + 1}`, `${to.next - to.into} pts to level ${to.level + 1}`)}
        </Typography>
        <Box aria-hidden sx={{ height: 8, borderRadius: 99, bgcolor: chrome.active, overflow: 'hidden' }}>
          <Box key={phase} sx={{
            height: '100%', borderRadius: 99, bgcolor: gold.bright, transformOrigin: 'left center',
            '--from': start, '--to': end, transform: `scaleX(${end})`,
            animation: reduced || phase === 0 ? 'none' : `${barFill} 900ms ${EASE} both`,
          }} />
        </Box>
      </Box>
    </Box>
  );
}

export default function TrophyCeremony({ toast, leaving, duration, waiting = 0, onOpen, onClose }: Props) {
  const reduced = useReducedMotion();
  const tier = TROPHY_TIERS[toast.tier];
  const platinum = toast.tier === 'platina';
  const bundle = toast.bundle ?? null;
  const points = bundle ? bundle.reduce((sum, b) => sum + TIER_POINTS[b.tier], 0) : TIER_POINTS[toast.tier];
  const mine = toast.who === null;

  // Os pontos contam só depois de a medalha assentar.
  const [counting, setCounting] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setCounting(true), 1150);
    return () => clearTimeout(t);
  }, [reduced]);
  const shown = useAnimatedNumber(counting ? points : 0, { duration: 800 });

  // O confete sai de trás da medalha, onde quer que o palco tenha caído na tela.
  const stage = useRef<HTMLDivElement | null>(null);
  const [originY, setOriginY] = useState<number | null>(null);
  useLayoutEffect(() => {
    const box = stage.current?.getBoundingClientRect();
    if (box) setOriginY((box.top + box.height / 2) / Math.max(1, window.innerHeight));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const colors = useMemo(
    () => (platinum ? [gold.bright, tier.medal, tier.hi, chrome.text] : [tier.medal, tier.hi, gold.bright, chrome.text]),
    [platinum, tier],
  );
  const count = bundle ? 110 : platinum ? 150 : toast.tier === 'ouro' ? 110 : toast.tier === 'prata' ? 80 : 60;

  const headline = bundle
    ? tr(`VOCÊ GANHOU ${bundle.length} TROFÉUS`, `YOU EARNED ${bundle.length} TROPHIES`)
    : toast.who ? tr(`${toast.who.toUpperCase()} DESBLOQUEOU`, `${toast.who.toUpperCase()} UNLOCKED`)
      : platinum ? tr('PLATINA CONQUISTADA', 'PLATINUM EARNED') : tr('TROFÉU DESBLOQUEADO', 'TROPHY UNLOCKED');
  const label = bundle
    ? `${tr(`Você ganhou ${bundle.length} troféus`, `You earned ${bundle.length} trophies`)}: ${bundle.map((b) => b.title).join(', ')}`
    : `${toast.who ? tr(`${toast.who} desbloqueou`, `${toast.who} unlocked`) : tr('Troféu desbloqueado', 'Trophy unlocked')}: ${toast.title} (${tier.label})${toast.description ? `. ${toast.description}` : ''}`;

  const line = (delay: number) => (reduced ? {} : { animation: `${lineIn} 520ms ${EASE} ${delay}ms both` });
  const medal = { xs: 124, sm: 164 };
  return (
    <Box role="dialog" aria-label={label} onClick={onClose} sx={{
      position: 'fixed', inset: 0, zIndex: 1400, overflow: 'hidden', cursor: 'pointer', color: chrome.text,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.25,
      px: 2.5, py: 3, textAlign: 'center', boxSizing: 'border-box',
      bgcolor: `${green.deepest}F2`,
      animation: reduced ? 'none' : leaving ? `${veilOut} 260ms ease-in forwards` : `${veilIn} 320ms ease-out`,
    }}>
      <Box role="status" aria-live="polite" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' }}>{label}</Box>

      {!reduced && originY !== null && (
        <Sparks cover confetti colors={colors} count={count} bursts={platinum || bundle ? 2 : 1} delay={760} originY={originY} />
      )}

      {/* O palco: raios, halo, anéis e a medalha. */}
      <Box ref={stage} sx={{ position: 'relative', width: medal, height: medal, flexShrink: 0, mb: 1 }}>
        {!reduced && (
          <>
            <Box aria-hidden sx={{ position: 'absolute', left: '50%', top: '50%', width: '84vmax', height: '84vmax', translate: '-50% -50%', pointerEvents: 'none' }}>
              <Box sx={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: `repeating-conic-gradient(from 0deg, ${tier.hi}24 0deg 9deg, ${tier.hi}00 9deg 18deg)`,
                maskImage: 'radial-gradient(circle closest-side, #000000 0%, #00000000 97%)', WebkitMaskImage: 'radial-gradient(circle closest-side, #000000 0%, #00000000 97%)',
                willChange: 'transform',
                animation: `${raysTurn} 38s linear infinite`,
              }} />
            </Box>
            <Box aria-hidden sx={{
              position: 'absolute', inset: '-55%', borderRadius: '50%', pointerEvents: 'none',
              background: `radial-gradient(circle, ${tier.medal}73 0%, ${tier.medal}00 68%)`,
              animation: `${haloBreathe} 3200ms ease-in-out infinite`,
            }} />
            {(platinum || bundle) && [0, 1, 2].map((i) => (
              <Box key={i} aria-hidden sx={{
                position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${gold.bright}`,
                animation: `${ringOut} 1300ms ${EASE} ${800 + i * 340}ms both`,
              }} />
            ))}
          </>
        )}
        {bundle ? (
          // Vários de uma vez: as medalhas em leque.
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {bundle.slice(0, 5).map((b, i, list) => {
              const off = i - (list.length - 1) / 2;
              return (
                <Box key={i} sx={{ ml: i ? '-22px' : 0, rotate: `${off * 9}deg`, translate: `0 ${Math.abs(off) * 7}px`, zIndex: 10 - Math.abs(Math.round(off)) }}>
                  <Box sx={{ animation: reduced ? 'none' : `${pop} 560ms ${EASE} ${220 + i * 130}ms both`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.45))' }}>
                    <TrophyMedal tier={b.tier} category={b.category} size={72} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box sx={{ position: 'relative', width: '100%', height: '100%', animation: reduced ? 'none' : `${medalFloat} 3600ms ease-in-out 1300ms infinite` }}>
            {/* Por fora cresce e assenta; por dentro gira (ver `motion.ts`). A sombra vai no miolo parado, pintada uma vez. */}
            <Box sx={{ position: 'relative', width: '100%', height: '100%', '--from-y': '-40px', willChange: 'transform, opacity', animation: reduced ? 'none' : `${medalLand} 900ms ${EASE_BACK} 140ms both` }}>
              <Box sx={{ position: 'relative', width: '100%', height: '100%', '--persp': '700px', willChange: 'transform', animation: reduced ? 'none' : `${medalTurn} 1150ms ${EASE_SPIN} 140ms both` }}>
                <Box sx={{ width: '100%', height: '100%', '& > svg': { width: '100%', height: '100%' }, filter: 'drop-shadow(0 10px 18px rgba(0,0,0,.5))' }}>
                  <TrophyMedal tier={toast.tier} category={toast.category} size={164} />
                </Box>
                {!reduced && (
                  // O brilho passa só pelo miolo, que todo grau tem redondo.
                  <Box aria-hidden sx={{ position: 'absolute', inset: 0, clipPath: 'circle(34%)', overflow: 'hidden' }}>
                    <Box sx={{
                      position: 'absolute', top: 0, bottom: 0, left: 0, width: '45%',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.8) 50%, rgba(255,255,255,0) 100%)',
                      animation: `${shine} 900ms ease-out 1250ms both`,
                    }} />
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      <Typography sx={{ position: 'relative', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.16em', color: gold.bright, ...line(760) }}>
        {headline}{bundle ? '' : ` · ${tier.label.toUpperCase()}`}
      </Typography>
      {bundle ? (
        <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0.25, maxWidth: 440, ...line(900) }}>
          <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: { xs: '1.375rem', sm: '1.75rem' }, lineHeight: 1.2 }}>
            {tr('Enquanto você estava fora', 'While you were away')}
          </Typography>
          {bundle.slice(0, 6).map((b, i) => (
            <Typography key={i} noWrap sx={{ fontSize: '0.9375rem', color: chrome.textSoft }}>
              {b.title} · {TROPHY_TIERS[b.tier].label}
            </Typography>
          ))}
          {bundle.length > 6 && <Typography sx={{ fontSize: '0.875rem', color: chrome.textSoft }}>{tr(`e mais ${bundle.length - 6}`, `and ${bundle.length - 6} more`)}</Typography>}
        </Box>
      ) : (
        <>
          <Typography sx={{ position: 'relative', fontFamily: displayFont, fontWeight: 700, fontSize: { xs: '1.625rem', sm: '2.25rem' }, lineHeight: 1.15, maxWidth: 560, overflowWrap: 'anywhere', ...line(900) }}>
            {toast.title}
          </Typography>
          {toast.description && (
            <Typography sx={{ position: 'relative', fontSize: { xs: '0.9375rem', sm: '1.0625rem' }, lineHeight: 1.45, color: chrome.textSoft, maxWidth: 440, ...line(1040) }}>
              {toast.description}
            </Typography>
          )}
        </>
      )}
      <Typography sx={{ position: 'relative', fontFamily: displayFont, fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem' }, color: gold.bright, fontVariantNumeric: 'tabular-nums', ...line(1180) }}>
        +{shown} pts
      </Typography>

      {mine && !bundle && typeof toast.pointsBefore === 'number' && (
        <LevelAct before={toast.pointsBefore} gained={points} reduced={reduced} />
      )}

      <Box sx={{ position: 'relative', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1, mt: 1, ...line(1500) }}>
        {onOpen && (
          <Button variant="contained" onClick={(e) => { e.stopPropagation(); onOpen(); }} sx={{ bgcolor: gold.bright, color: green.deepest, fontWeight: 700, '&:hover': { bgcolor: gold.main } }}>
            {tr('Ver troféus', 'See trophies')}
          </Button>
        )}
        <Button onClick={(e) => { e.stopPropagation(); onClose(); }} sx={{ color: chrome.text, fontWeight: 600 }}>
          {waiting > 0 ? tr(`Próximo (mais ${waiting})`, `Next (${waiting} more)`) : tr('Continuar', 'Continue')}
        </Button>
      </Box>

      {duration && !reduced && (
        <Box aria-hidden sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, bgcolor: gold.bright, transformOrigin: 'left center', animation: `${timeLeft} ${duration}ms linear forwards` }} />
      )}
    </Box>
  );
}
