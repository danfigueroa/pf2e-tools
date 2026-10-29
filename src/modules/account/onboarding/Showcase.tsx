import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { keyframes } from '@emotion/react';
import { Box, ButtonBase } from '@mui/material';
import { chrome, gold } from '../../../theme';
import { useReducedMotion } from '../../../motion/motion';
import { SCENES } from './scenes';
import { SceneFrame } from './SceneFrame';
import { ScenePlaying } from './useSceneClock';

/** Quanto cada cena fica na tela antes da próxima. */
const SCENE_MS = 7000;
const FADE_MS = 450;
const SWIPE_PX = 40;

const fill = keyframes`
  0% { transform: scaleX(0); }
  100% { transform: scaleX(1); }
`;
const sceneIn = keyframes`
  0% { opacity: 0; transform: translateY(10px) scale(0.98); }
  100% { opacity: 1; transform: none; }
`;
const sceneOut = keyframes`
  0% { opacity: 1; transform: none; }
  100% { opacity: 0; transform: translateY(-6px) scale(0.98); }
`;

/**
 * A vitrine da tela de entrada: uma cena por vez, trocando sozinha. Só a cena da vez (e a
 * que está saindo, durante o crossfade) fica montada. Quem marca o tempo é a barra de
 * progresso (CSS), e o fim dela troca a cena: com o mouse em cima ela para; com a aba oculta
 * ou a vitrine fora da tela, para a cena também. Movimento reduzido: só troca pelos botões.
 */
export const Showcase = () => {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [onScreen, setOnScreen] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const pointerX = useRef<number | null>(null);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (leaving === null) return;
    const timer = window.setTimeout(() => setLeaving(null), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  // A cena anima sempre que alguém pode vê-la; o mouse em cima só segura a troca.
  const playing = !hidden && onScreen && !reduced;
  const advancing = playing && !hovered;

  const go = (raw: number) => {
    const next = (raw + SCENES.length) % SCENES.length;
    if (next === index) return;
    setLeaving(reduced ? null : index);
    setIndex(next);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  };
  const onPointerDown = (e: PointerEvent) => { pointerX.current = e.clientX; };
  const onPointerUp = (e: PointerEvent) => {
    if (pointerX.current === null) return;
    const dx = e.clientX - pointerX.current;
    pointerX.current = null;
    if (Math.abs(dx) >= SWIPE_PX) go(index + (dx < 0 ? 1 : -1));
  };

  const scene = SCENES[index];
  const stage = (i: number, entering: boolean) => {
    const s = SCENES[i];
    return (
      <Box
        key={s.id}
        aria-hidden={!entering}
        sx={{
          gridArea: '1 / 1',
          minWidth: 0,
          pointerEvents: entering ? undefined : 'none',
          animation: reduced ? 'none' : `${entering ? sceneIn : sceneOut} ${FADE_MS}ms cubic-bezier(.2,.8,.2,1) forwards`,
          // A cena congela junto com a vitrine (as animações CSS de dentro também); com
          // movimento reduzido ela é só o quadro final, sem animação nenhuma.
          '& *': reduced
            ? { animation: 'none !important', transition: 'none !important' }
            : playing ? undefined : { animationPlayState: 'paused' },
        }}
      >
        <ScenePlaying.Provider value={entering && playing}>
          <SceneFrame label={s.label} dark={s.dark}>
            <s.Scene />
          </SceneFrame>
        </ScenePlaying.Provider>
      </Box>
    );
  };

  return (
    <Box
      ref={root}
      role="region"
      aria-roledescription="carrossel"
      aria-label="O que dá para fazer no Covil de Dados"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{ width: '100%', maxWidth: 560, mx: { xs: 'auto', md: 0 }, minWidth: 0 }}
    >
      <Box
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { pointerX.current = null; }}
        sx={{ display: 'grid', touchAction: 'pan-y', userSelect: 'none' }}
      >
        {leaving !== null && leaving !== index && stage(leaving, false)}
        {stage(index, true)}
      </Box>

      <Box key={scene.id} sx={{ mt: 2.5, minHeight: { xs: 104, sm: 92 }, animation: reduced ? 'none' : `${sceneIn} ${FADE_MS}ms ease-out` }}>
        <Box
          component="h2"
          aria-live="polite"
          sx={{ m: 0, fontFamily: '"Cinzel", Georgia, serif', fontWeight: 700, fontSize: { xs: '1.1rem', sm: '1.25rem' }, color: chrome.text }}
        >
          {scene.title}
        </Box>
        <Box component="p" sx={{ m: 0, mt: 0.75, fontSize: '0.95rem', lineHeight: 1.5, color: chrome.textSoft }}>{scene.text}</Box>
      </Box>

      <Box sx={{ mt: 1.5, display: 'flex', gap: { xs: 0.75, sm: 1 } }}>
        {SCENES.map((s, i) => {
          const active = i === index;
          return (
            <ButtonBase
              key={s.id}
              onClick={() => go(i)}
              aria-label={s.label}
              aria-current={active ? 'true' : undefined}
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 32,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'flex-end',
                gap: 0.75,
                borderRadius: 1,
                fontFamily: 'inherit',
                '&.Mui-focusVisible': { outline: `2px solid ${gold.bright}`, outlineOffset: 2 },
              }}
            >
              <Box
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  fontSize: '0.72rem',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: active ? gold.bright : chrome.textMuted,
                  fontWeight: active ? 700 : 400,
                  transition: 'color 200ms',
                }}
              >
                {s.label}
              </Box>
              <Box sx={{ height: 3, borderRadius: 2, backgroundColor: chrome.lineStrong, overflow: 'hidden' }}>
                {active && (
                  <Box
                    key={index}
                    onAnimationEnd={() => go(index + 1)}
                    sx={{
                      height: '100%',
                      backgroundColor: gold.bright,
                      transformOrigin: 'left',
                      animation: reduced ? 'none' : `${fill} ${SCENE_MS}ms linear forwards`,
                      animationPlayState: advancing ? 'running' : 'paused',
                    }}
                  />
                )}
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
};
