import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { ChevronRight as ChevronIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { chrome, displayFont, gold, green, ink, parchment, rule, TROPHY_TIERS } from '../../theme';
import type { RankingEntry, TrophyRole } from '../../services/trophies';
import { initialsOf } from '../../layouts/navigation';
import { useInView } from '../../motion/useInView';
import { useReducedMotion } from '../../motion/motion';
import { useAnimatedNumber } from '../../motion/useAnimatedNumber';
import { Sparks } from './Sparks';
import { crownBob, EASE, EASE_BACK, flash, grow, haloBreathe, podiumUp, raysTurn, reveal, sweep } from './motion';
import { tr } from '../../i18n';

// O ranking da mesa (aba "A mesa" dos Troféus). Cada papel tem a sua arena: um palco escuro com o
// PÓDIO (holofote girando, coroa no líder, colunas de metal subindo do chão, pontos contando e
// confete quando o palco aparece), a frase da DISPUTA (quanto falta para alcançar quem está na
// frente) e a classificação completa, que desliza ao reordenar (FLIP).
// Empate divide o lugar (dois "1º", o próximo é o 3º). Quem não pontuou não sobe em degrau: o
// lugar fica VAGO, à vista, para alguém tomar. Com menos de 3 pessoas na lista não há pódio.

const Count = ({ value, shown, duration = 1100 }: { value: number; shown: boolean; duration?: number }) => (
  <>{useAnimatedNumber(shown ? value : 0, { duration })}</>
);

const METAL = [TROPHY_TIERS.ouro, TROPHY_TIERS.prata, TROPHY_TIERS.bronze] as const;
const STEP = [{ xs: 104, sm: 132 }, { xs: 76, sm: 96 }, { xs: 54, sm: 68 }] as const;
const CROWN = 'M3.5 8l4.5 4 4-7 4 7 4.5-4-1.8 10H5.3z';

interface Placed { entry: RankingEntry; place: number; points: number }

const first = (name: string) => name.split(' ')[0];

/** Um degrau do pódio. `slot` é a posição no palco (0 = centro); o metal e a altura vêm do LUGAR (empate sobe igual). */
function Step({ placed, slot, shown, me, onOpen }: { placed: Placed | null; slot: number; shown: boolean; me: string | null; onOpen: (userId: string) => void }) {
  const reduced = useReducedMotion();
  const rank = placed ? Math.min(placed.place, 3) - 1 : slot;
  const metal = METAL[rank];
  const champion = !!placed && placed.place === 1;
  const delay = [120, 300, 460][slot];
  const avatar = champion ? { xs: 56, sm: 72 } : { xs: 46, sm: 56 };
  const column = (
    <Box sx={{
      position: 'relative', overflow: 'hidden', height: STEP[rank], borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: 1,
      ...(placed
        ? { background: `linear-gradient(180deg, ${metal.hi} 0%, ${metal.medal} 45%, ${metal.lo} 100%)`, color: metal.engrave, boxShadow: `0 -6px 26px ${metal.medal}66` }
        : { bgcolor: chrome.raised, color: chrome.label, border: `1px dashed ${chrome.label}`, borderBottom: 0 }),
      transformOrigin: 'center bottom',
      animation: shown && !reduced ? `${podiumUp} 760ms ${EASE_BACK} ${delay}ms both` : 'none',
    }}>
      <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: champion ? { xs: '1.75rem', sm: '2.25rem' } : { xs: '1.375rem', sm: '1.75rem' }, lineHeight: 1 }}>
        {placed ? placed.place : slot + 1}
      </Typography>
      {placed && !reduced && (
        // De tempos em tempos um reflexo percorre o metal.
        <Box aria-hidden sx={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: '34%',
          background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.55) 50%, rgba(255,255,255,0) 100%)',
          animation: `${sweep} 4200ms ease-in-out ${1400 + slot * 700}ms infinite`,
        }} />
      )}
    </Box>
  );

  if (!placed) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, textAlign: 'center', ...reveal(shown, slot + 1) }}>
        <Box sx={{ alignSelf: 'center', width: avatar, height: avatar, borderRadius: '50%', border: `2px dashed ${chrome.label}`, color: chrome.label, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: displayFont, fontWeight: 700, fontSize: '1.25rem' }}>?</Box>
        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: chrome.textMuted, mt: 0.75 }}>{tr('Lugar vago', 'Open spot')}</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: chrome.label, mb: 0.75 }}>{tr('quem vai tomar?', 'who takes it?')}</Typography>
        {column}
      </Box>
    );
  }

  const e = placed.entry;
  const mine = e.userId === me;
  return (
    <ButtonBase onClick={() => onOpen(e.userId)}
      aria-label={tr(`${placed.place}º lugar: ${e.name}, ${placed.points} pontos`, `Place ${placed.place}: ${e.name}, ${placed.points} points`)}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', minWidth: 0, borderRadius: 2, textAlign: 'center', ...reveal(shown, slot + 1), '&:hover .podium-avatar, &:focus-visible .podium-avatar': { transform: 'translateY(-4px) scale(1.05)' } }}>
      <Box className="podium-avatar" sx={{ alignSelf: 'center', position: 'relative', transition: `transform 320ms ${EASE_BACK}` }}>
        {champion && (
          <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={{
            position: 'absolute', left: '50%', bottom: '100%', width: { xs: 26, sm: 32 }, height: { xs: 26, sm: 32 }, ml: { xs: '-13px', sm: '-16px' }, mb: '-4px',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.5))', animation: reduced ? 'none' : `${crownBob} 2600ms ease-in-out infinite`,
          }}>
            <path d={CROWN} fill={gold.bright} stroke={TROPHY_TIERS.ouro.lo} strokeWidth="1" strokeLinejoin="round" />
          </Box>
        )}
        {/* O aro de metal é o fundo em gradiente aparecendo em volta do miolo. */}
        <Box sx={{ width: avatar, height: avatar, borderRadius: '50%', p: '3px', boxSizing: 'border-box', background: `linear-gradient(145deg, ${metal.hi} 0%, ${metal.medal} 50%, ${metal.lo} 100%)`, boxShadow: `0 0 18px ${metal.medal}80` }}>
          <Box sx={{ width: '100%', height: '100%', borderRadius: '50%', bgcolor: green.mid, color: chrome.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: champion ? '1rem' : '0.875rem' }}>
            {initialsOf(e.name)}
          </Box>
        </Box>
      </Box>
      <Typography noWrap sx={{ fontWeight: 700, fontSize: { xs: '0.875rem', sm: '1rem' }, color: chrome.text, mt: 0.75 }}>{first(e.name)}</Typography>
      {mine && <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', color: gold.bright }}>{tr('VOCÊ', 'YOU')}</Typography>}
      <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: champion ? { xs: '1.375rem', sm: '1.75rem' } : { xs: '1.125rem', sm: '1.375rem' }, color: gold.bright, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
        <Count value={placed.points} shown={shown} duration={1400} />
        <Box component="span" sx={{ fontSize: '0.6875rem', fontFamily: 'inherit', ml: 0.5, color: chrome.textSoft }}>pts</Box>
      </Typography>
      <Typography noWrap sx={{ fontSize: '0.6875rem', color: chrome.textSoft, mb: 0.75 }}>
        {e.count} {e.count === 1 ? tr('troféu', 'trophy') : tr('troféus', 'trophies')}
      </Typography>
      {column}
    </ButtonBase>
  );
}

/** A frase da disputa: para quem está na lista, quanto falta para alcançar quem vem na frente. */
function chase(placed: Placed[], me: string | null): string {
  const scored = placed.filter((p) => p.points > 0);
  if (scored.length === 0) return tr('Ninguém pontuou ainda: o primeiro troféu vale a liderança.', 'Nobody has scored yet: the first trophy takes the lead.');
  const mine = placed.find((p) => p.entry.userId === me);
  const leaders = placed.filter((p) => p.place === 1);
  if (!mine) {
    if (leaders.length > 1) return tr(`${leaders.map((p) => first(p.entry.name)).join(' e ')} dividem a liderança. O próximo troféu desempata.`, `${leaders.map((p) => first(p.entry.name)).join(' and ')} share the lead. The next trophy breaks the tie.`);
    const second = placed.find((p) => p.place > 1);
    const gap = second ? leaders[0].points - second.points : leaders[0].points;
    return tr(`${first(leaders[0].entry.name)} lidera com ${gap} pts de vantagem.`, `${first(leaders[0].entry.name)} leads by ${gap} pts.`);
  }
  const tied = placed.filter((p) => p.place === mine.place && p !== mine);
  if (mine.points > 0 && tied.length > 0) {
    return tr(`Você divide o ${mine.place}º lugar com ${tied.map((p) => first(p.entry.name)).join(' e ')}. O próximo troféu desempata!`, `You share place ${mine.place} with ${tied.map((p) => first(p.entry.name)).join(' and ')}. The next trophy breaks the tie!`);
  }
  if (mine.place === 1) {
    const second = placed.find((p) => p.place > 1);
    return second
      ? tr(`Você lidera a mesa, com ${mine.points - second.points} pts sobre ${first(second.entry.name)}. Segure a coroa!`, `You lead the table, ${mine.points - second.points} pts ahead of ${first(second.entry.name)}. Keep the crown!`)
      : tr('Você lidera a mesa. Segure a coroa!', 'You lead the table. Keep the crown!');
  }
  // Quem está logo à frente (o último com mais pontos que eu).
  const ahead = [...placed].reverse().find((p) => p.points > mine.points);
  if (!ahead) return tr('O próximo troféu coloca você na disputa.', 'The next trophy puts you in the race.');
  return tr(`Faltam ${ahead.points - mine.points} pts para você alcançar ${first(ahead.entry.name)} no ${ahead.place}º lugar.`, `${ahead.points - mine.points} pts to catch ${first(ahead.entry.name)} in place ${ahead.place}.`);
}

/** A arena de um papel: palco com pódio + a classificação completa. */
function Arena({ title, subtitle, role, list, me }: { title: string; subtitle: string; role: TrophyRole; list: RankingEntry[]; me: string | null }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [ref, shown] = useInView<HTMLDivElement>();
  const nodes = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());
  const points = useRef(new Map<string, number>());
  const [gained, setGained] = useState<Set<string>>(new Set());
  const open = (userId: string) => navigate(userId === me ? '/trofeus' : `/trofeus/${userId}`);

  // Empate divide o lugar: o lugar é 1 + quantos têm MAIS pontos.
  const placed = useMemo<Placed[]>(() => list.map((entry) => ({
    entry, points: entry.points[role], place: 1 + list.filter((o) => o.points[role] > entry.points[role]).length,
  })), [list, role]);

  useLayoutEffect(() => {
    // Quem ganhou pontos desde a última lista pisca (a primeira lista não conta).
    const up = new Set<string>();
    for (const e of list) {
      const before = points.current.get(e.userId);
      if (before !== undefined && e.points[role] > before) up.add(e.userId);
      points.current.set(e.userId, e.points[role]);
    }
    if (up.size) setGained(up);
    const moved: HTMLElement[] = [];
    for (const [key, el] of nodes.current) {
      const before = tops.current.get(key);
      const now = el.offsetTop;
      tops.current.set(key, now);
      if (reduced || before === undefined || before === now) continue;
      el.style.transition = 'none';
      el.style.transform = `translateY(${before - now}px)`;
      moved.push(el);
    }
    if (moved.length === 0) return;
    const raf = requestAnimationFrame(() => {
      for (const el of moved) {
        el.style.transition = `transform 620ms ${EASE}`;
        el.style.transform = '';
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [list, role, reduced]);

  const top = Math.max(1, ...placed.map((p) => p.points));
  const scored = placed.filter((p) => p.points > 0);
  const podium = list.length >= 3;
  const trophies = list.reduce((sum, e) => sum + e.count, 0);
  const total = placed.reduce((sum, p) => sum + p.points, 0);
  const colors = useMemo(() => [gold.bright, TROPHY_TIERS.ouro.hi, TROPHY_TIERS.prata.hi, TROPHY_TIERS.bronze.hi], []);

  return (
    <Box ref={ref} component="section" sx={{ borderRadius: 3, border: `1px solid ${rule}`, bgcolor: parchment.paper, overflow: 'hidden' }}>
      {/* O palco. */}
      <Box sx={{ position: 'relative', overflow: 'hidden', bgcolor: green.deepest, color: chrome.text, px: { xs: 1.5, sm: 3 }, pt: { xs: 2, sm: 2.5 } }}>
        {podium && scored.length > 0 && (
          <Box aria-hidden sx={{ position: 'absolute', left: '50%', top: { xs: 150, sm: 170 }, width: 900, height: 900, translate: '-50% -50%', pointerEvents: 'none' }}>
            <Box sx={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: `repeating-conic-gradient(from 0deg, ${gold.bright}1F 0deg 8deg, ${gold.bright}00 8deg 20deg)`,
              maskImage: 'radial-gradient(circle, #000000 0%, #00000000 62%)', WebkitMaskImage: 'radial-gradient(circle, #000000 0%, #00000000 62%)',
              animation: reduced ? 'none' : `${raysTurn} 60s linear infinite`,
            }} />
            <Box sx={{
              position: 'absolute', inset: '32%', borderRadius: '50%', background: `radial-gradient(circle, ${gold.bright}3D 0%, ${gold.bright}00 70%)`,
              animation: reduced ? 'none' : `${haloBreathe} 3600ms ease-in-out infinite`,
            }} />
          </Box>
        )}
        {podium && scored.length > 0 && shown && !reduced && <Sparks cover confetti colors={colors} count={70} delay={900} originY={0.5} />}

        <Box sx={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', color: gold.bright }}>{tr('RANKING DA MESA', 'TABLE RANKING')}</Typography>
            <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: { xs: '1.375rem', sm: '1.75rem' }, lineHeight: 1.2 }}>{title}</Typography>
            <Typography sx={{ fontSize: '0.875rem', color: chrome.textSoft }}>{subtitle}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {[[trophies, tr('troféus', 'trophies')], [total, tr('pontos', 'points')]].map(([n, label], i) => (
              <Box key={label} sx={{ px: 1.5, py: 0.75, borderRadius: 2, bgcolor: chrome.raised, textAlign: 'center', minWidth: 68, ...reveal(shown, i) }}>
                <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.1, color: gold.bright, fontVariantNumeric: 'tabular-nums' }}><Count value={Number(n)} shown={shown} /></Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: chrome.textSoft }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {podium && (
          // 2º, 1º e 3º: o líder no centro. Só sobe quem pontuou; o resto do pódio fica vago.
          <Box sx={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', alignItems: 'end', gap: { xs: 0.75, sm: 2 }, maxWidth: 560, mx: 'auto', pt: { xs: 5, sm: 6 } }}>
            {[1, 0, 2].map((slot) => <Step key={slot} slot={slot} placed={scored[slot] ?? null} shown={shown} me={me} onOpen={open} />)}
          </Box>
        )}

        {/* A disputa, no chão do palco. */}
        <Box sx={{ position: 'relative', mx: { xs: -1.5, sm: -3 }, mt: podium ? 0 : 2, px: { xs: 1.5, sm: 3 }, py: 1.25, bgcolor: chrome.raised, borderTop: `2px solid ${gold.main}`, textAlign: 'center' }}>
          <Typography sx={{ fontSize: { xs: '0.875rem', sm: '0.9375rem' }, fontWeight: 600, color: chrome.text }}>{chase(placed, me)}</Typography>
        </Box>
      </Box>

      {/* A classificação completa. */}
      <Box sx={{ position: 'relative', p: { xs: 1, sm: 2 } }}>
        {placed.map(({ entry: e, place, points: pts }, i) => {
          const metal = pts > 0 && place <= 3 ? METAL[place - 1] : null;
          const gap = top - pts;
          return (
            <ButtonBase
              key={e.userId}
              ref={(el: HTMLButtonElement | null) => { if (el) nodes.current.set(e.userId, el); else nodes.current.delete(e.userId); }}
              onClick={() => open(e.userId)}
              sx={{
                width: '100%', display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, px: { xs: 0.75, sm: 1.25 }, py: 1.25, minHeight: 64,
                borderTop: i ? `1px solid ${parchment.sunken}` : 0, justifyContent: 'flex-start', textAlign: 'left', borderRadius: 1.5,
                bgcolor: e.userId === me ? `${gold.bright}1F` : 'transparent',
                ...reveal(shown, i + 3),
                ...(gained.has(e.userId) && !reduced ? { animation: `${flash} 1600ms ease-out` } : {}),
                '&:hover': { bgcolor: `${gold.bright}14` },
              }}
            >
              {/* O lugar: moeda de metal para quem está no pódio, número para o resto. */}
              <Box sx={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: displayFont, fontWeight: 700, fontSize: '0.9375rem',
                ...(metal
                  ? { background: `linear-gradient(145deg, ${metal.hi} 0%, ${metal.medal} 50%, ${metal.lo} 100%)`, color: metal.engrave, boxShadow: `0 1px 3px rgba(0,0,0,.25)` }
                  : { color: ink.secondary }),
              }}>{pts > 0 ? place : '–'}</Box>
              <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: green.mid, color: chrome.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>
                {initialsOf(e.name)}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography noWrap sx={{ fontWeight: 600 }}>{e.name}{e.userId === me ? tr(' (você)', ' (you)') : ''}</Typography>
                <Box sx={{ height: 6, borderRadius: 99, bgcolor: parchment.sunken, overflow: 'hidden', maxWidth: 320 }} aria-hidden>
                  <Box sx={{ height: '100%', borderRadius: 99, bgcolor: metal ? metal.medal : gold.main, ...grow(shown, pts / top, 300 + i * 70) }} />
                </Box>
                <Typography noWrap sx={{ fontSize: '0.8125rem', color: ink.secondary }}>
                  {e.count} {e.count === 1 ? tr('troféu', 'trophy') : tr('troféus', 'trophies')}{e.platinum ? tr(` · ${e.platinum} platina`, ` · ${e.platinum} platinum`) : ''}{e.last ? tr(` · último: ${e.last.title}`, ` · latest: ${e.last.title}`) : ''}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                  <Count value={pts} shown={shown} />
                </Typography>
                <Typography sx={{ fontSize: '0.6875rem', color: ink.secondary, fontVariantNumeric: 'tabular-nums' }}>
                  {gap > 0 ? tr(`−${gap} do líder`, `−${gap} to lead`) : pts > 0 ? tr('na liderança', 'in the lead') : tr('pts', 'pts')}
                </Typography>
              </Box>
              <ChevronIcon sx={{ color: gold.deep, display: { xs: 'none', sm: 'block' } }} />
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

export function Ranking({ entries, me }: { entries: RankingEntry[]; me: string | null }) {
  const byName = (a: RankingEntry, b: RankingEntry) => a.name.localeCompare(b.name);
  // Cada pessoa aparece só na lista do papel que tem NESTA mesa: os pontos são globais, e o GM que já jogou não
  // disputa com os jogadores (os pontos de jogador dele seguem no perfil).
  const players = entries.filter((e) => e.role !== 'gm').sort((a, b) => b.points.player - a.points.player || byName(a, b));
  const masters = entries.filter((e) => e.role === 'gm').sort((a, b) => b.points.gm - a.points.gm || byName(a, b));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {players.length > 0 && <Arena title={tr('Jogadores', 'Players')} subtitle={tr('Quem mais conquistou troféus jogando nesta mesa.', 'Who earned the most trophies playing at this table.')} role="player" list={players} me={me} />}
      {masters.length > 0 && <Arena title={tr('Mestres', 'Game masters')} subtitle={tr('Os troféus de quem conduz a mesa.', 'The trophies of those who run the table.')} role="gm" list={masters} me={me} />}
    </Box>
  );
}
