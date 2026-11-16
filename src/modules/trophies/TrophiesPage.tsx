import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Alert, Box, ButtonBase, Chip, Skeleton, Tab, Tabs, Typography } from '@mui/material';
import { ArrowBack as BackIcon, EmojiEvents as TrophyIcon } from '@mui/icons-material';
import { Link, useParams } from 'react-router-dom';
import { chrome, displayFont, gold, green, ink, parchment, rule, TROPHY_TIERS } from '../../theme';
import { useRole } from '../../services/auth';
import { MESAS } from '../../services/mesa';
import { onTableEvent } from '../../services/notifications';
import {
  fetchTrophyProfile, fetchTrophyRanking, levelOf, TIER_POINTS,
  type RankingEntry, type TrophyDef, type TrophyProfile, type TrophyRole, type TrophyTier, type Unlocked,
} from '../../services/trophies';
import { useInView } from '../../motion/useInView';
import { useReducedMotion } from '../../motion/motion';
import { useAnimatedNumber } from '../../motion/useAnimatedNumber';
import { TrophyMedal } from './TrophyMedal';
import { LevelRing } from './LevelRing';
import { Ranking } from './Ranking';
import type { UnlockToast } from './TrophyUnlockCard';
import { EASE_BACK, glowNew, grow, lockWiggle, reveal, shine, sweep } from './motion';
import { locale, tr } from '../../i18n';

// Troféus do Covil (`/trofeus`, `/trofeus/:user`): o perfil de troféus da conta — o meu ou o de
// um colega da mesa — e o ranking da mesa. O catálogo vem do servidor junto com o perfil.
//
// Animação (só apresenta; ver `motion.ts`): os cartões entram em cascata quando a grade aparece,
// o nível, os pontos e as contagens correm até o valor, as barras crescem, o troféu ganho desde a
// última visita respira com o selo "Novo" e o ranking desliza ao reordenar (FLIP). Tocar num troféu
// ganho revê a cerimônia do desbloqueio (a mesma do aviso, chunk à parte).

const TrophyCeremony = lazy(() => import('./TrophyCeremony'));

const CATEGORIES: Record<string, string> = {
  ficha: tr('Ficha', 'Sheet'), historia: tr('História e notas', 'Story and notes'), presenca: tr('Presença', 'Attendance'), dados: tr('Dados', 'Dice'), sorte: tr('Sorte e azar', 'Luck'),
  combate: tr('Combate', 'Combat'), destaques: tr('Destaques da sessão', 'Session highlights'),
  mesa: tr('A mesa', 'The table'), wiki: tr('Wiki da Mesa', 'Table Wiki'), mestre: tr('Mestre', 'Game master'), platina: tr('Platina', 'Platinum'),
};
/** O que rende troféu em cada categoria, em termos gerais: os troféus em si seguem secretos. */
const CATEGORY_BLURBS: Record<string, string> = {
  ficha: tr('Publicar e evoluir os seus personagens.', 'Publishing and leveling up your characters.'),
  historia: tr('Escrever o background e as anotações da campanha.', 'Writing your background and campaign notes.'),
  presenca: tr('Aparecer nas sessões e manter a frequência.', 'Showing up to sessions and keeping a streak.'),
  dados: tr('Rolar muito e tirar resultados marcantes.', 'Rolling a lot and landing memorable results.'),
  sorte: tr('Sequências de sorte e de azar nos dados.', 'Streaks of good and bad luck on the dice.'),
  combate: tr('Causar dano pesado em rolagens e em sessões.', 'Dealing heavy damage in rolls and sessions.'),
  destaques: tr('Ser eleito destaque do grupo ao fim da sessão.', 'Being named the group\'s standout at the end of a session.'),
  mesa: tr('Ajudar a mesa: compartilhar regras, passar itens e corrigir traduções.', 'Helping the table: sharing rules, passing items and fixing translations.'),
  wiki: tr('Criar, ler e editar páginas da Wiki da Mesa.', 'Creating, reading and editing Table Wiki pages.'),
  mestre: tr('Conduzir sessões, combates, mapas, diário e segredos da Wiki.', 'Running sessions, combats, maps, the journal and Wiki secrets.'),
  platina: tr('Conquistar todos os outros troféus do papel.', 'Earning every other trophy of the role.'),
};
const TIER_ORDER: TrophyTier[] = ['platina', 'ouro', 'prata', 'bronze'];
const mesaName = (id: string | null) => MESAS.find((m) => m.id === id)?.nome ?? null;
const date = (at: number) => new Date(at).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
const card = { borderRadius: 3, bgcolor: parchment.paper, border: `1px solid ${rule}` };

// --- "Novo desde a última visita" (por conta, neste aparelho) --------------------------------

const seenKey = (userId: string) => `pf2e:trophies:seen:${userId}`;

/** Os ids que a pessoa ainda não tinha visto nesta página. Grava os de agora como vistos. */
function useFreshIds(userId: string | null, unlocked: string[] | null): Set<string> {
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const ids = unlocked?.join('|') ?? null;
  useEffect(() => {
    if (!userId || ids === null) return;
    const list = ids ? ids.split('|') : [];
    let seen: string[] | null = null;
    try { seen = JSON.parse(localStorage.getItem(seenKey(userId)) ?? 'null'); } catch { seen = null; }
    // Primeira visita neste aparelho: nada é "novo", senão a coleção inteira piscaria.
    if (Array.isArray(seen)) {
      const old = new Set(seen);
      setFresh((prev) => new Set([...prev, ...list.filter((id) => !old.has(id))]));
    }
    try { localStorage.setItem(seenKey(userId), JSON.stringify(list)); } catch { /* sem storage: vale nesta carga */ }
  }, [userId, ids]);
  return fresh;
}

// --- Peças ----------------------------------------------------------------------------------

/** Barra de progresso que cresce do zero quando aparece. */
const Bar = ({ fraction, shown, track = parchment.sunken, fill = gold.main, height = 6, delay = 0 }: { fraction: number; shown: boolean; track?: string; fill?: string; height?: number; delay?: number }) => (
  <Box sx={{ height, borderRadius: 99, bgcolor: track, overflow: 'hidden', flex: 1 }} aria-hidden>
    <Box sx={{ height: '100%', borderRadius: 99, bgcolor: fill, ...grow(shown, fraction, delay) }} />
  </Box>
);

const Count = ({ value, shown, duration = 1000 }: { value: number; shown: boolean; duration?: number }) => (
  <>{useAnimatedNumber(shown ? value : 0, { duration })}</>
);

function TrophyCard({ def, at, mesa, progress, mine, fresh, shown, index, onReplay }: {
  def: TrophyDef; at: number | null; mesa: string | null; progress: number; mine: boolean; fresh: boolean; shown: boolean; index: number
  onReplay: (def: TrophyDef) => void
}) {
  const unlocked = at !== null;
  const secret = !unlocked;
  const tier = TROPHY_TIERS[def.tier];
  const reduced = useReducedMotion();
  const stagger = Math.min(index, 16) * 45;
  const sx = {
    ...card, borderRadius: 2.5, p: 2, display: 'flex', gap: 1.75, alignItems: 'flex-start', position: 'relative',
    justifyContent: 'flex-start', textAlign: 'left', width: '100%', font: 'inherit',
    bgcolor: unlocked ? tier.tint : parchment.paper, borderColor: fresh ? gold.bright : unlocked ? tier.medal : rule,
    // A platina ganha tem um halo que fica.
    ...(unlocked && def.tier === 'platina' ? { boxShadow: `0 0 18px ${tier.medal}55` } : {}),
    ...reveal(shown, index),
    ...(fresh && !reduced ? { animation: `${glowNew} 1600ms ease-in-out ${600 + stagger}ms 2` } : {}),
    // O reflexo atravessa a medalha quando o cartão ganho recebe o ponteiro ou o foco.
    ...(unlocked && !reduced ? { '&:hover .medal-shine, &:focus-visible .medal-shine': { animation: `${shine} 800ms ease-out both` } } : {}),
  } as const;
  const body = (
    <>
      {fresh && !reduced && (
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none' }}>
          <Box sx={{
            position: 'absolute', top: 0, bottom: 0, left: 0, width: '30%',
            background: `linear-gradient(90deg, ${gold.bright}00 0%, ${gold.bright}55 50%, ${gold.bright}00 100%)`,
            animation: `${sweep} 1300ms ease-out ${700 + stagger}ms 2 both`,
          }} />
        </Box>
      )}
      <Box sx={{
        position: 'relative', flexShrink: 0,
        transform: shown || reduced ? 'none' : 'scale(0.6) rotate(-18deg)',
        transition: `transform 640ms ${EASE_BACK}`, transitionDelay: `${120 + stagger}ms`,
      }}>
        <TrophyMedal tier={def.tier} category={def.category} locked={!unlocked} size={56} />
        {unlocked && !reduced && (
          <Box aria-hidden sx={{ position: 'absolute', inset: 0, clipPath: 'circle(34%)', overflow: 'hidden', pointerEvents: 'none' }}>
            <Box className="medal-shine" sx={{
              position: 'absolute', top: 0, bottom: 0, left: 0, width: '45%', opacity: 0,
              background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.85) 50%, rgba(255,255,255,0) 100%)',
            }} />
          </Box>
        )}
      </Box>
      <Box sx={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
          <Typography component="h3" sx={{ fontWeight: 700, color: unlocked ? ink.primary : ink.secondary, lineHeight: 1.25 }}>
            {secret ? tr('Troféu secreto', 'Secret trophy') : def.title}
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', color: tier.ink, flexShrink: 0, textTransform: 'uppercase' }}>
            {fresh ? tr('Novo!', 'New!') : tier.label}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.875rem', color: ink.secondary, lineHeight: 1.45 }}>
          {secret ? (mine ? tr('Continue jogando para descobrir.', 'Keep playing to find out.') : tr('Ainda não descoberto.', 'Not discovered yet.')) : def.description}
        </Typography>
        {unlocked ? (
          <Typography sx={{ fontSize: '0.75rem', color: ink.secondary, mt: 0.25 }}>
            {date(at)}{mesaName(mesa) ? ` · ${mesaName(mesa)}` : ''}
          </Typography>
        ) : def.goal > 1 && !secret && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Bar fraction={progress / def.goal} shown={shown} delay={250 + stagger} />
            <Typography sx={{ fontSize: '0.75rem', color: ink.secondary, fontVariantNumeric: 'tabular-nums' }}>
              <Count value={progress} shown={shown} />/{def.goal}
            </Typography>
          </Box>
        )}
      </Box>
    </>
  );
  // O ganho é um botão: tocar revê o desbloqueio.
  return unlocked
    ? <ButtonBase component="article" onClick={() => onReplay(def)} title={tr('Rever o desbloqueio', 'Replay the unlock')} sx={sx}>{body}</ButtonBase>
    : <Box component="article" sx={sx}>{body}</Box>;
}

function ProfileHeader({ name, profile, hasGm }: { name: string; profile: TrophyProfile; hasGm: boolean }) {
  const [ref, shown] = useInView<HTMLDivElement>();
  const got = new Set(profile.unlocked.map((u) => u.id));
  // Quem mestra conta os dois conjuntos; quem só joga, o de jogador.
  const ofRole = profile.catalog.filter((d) => hasGm || d.role === 'player');
  const total = profile.points.player + profile.points.gm;
  const lvl = levelOf(total);
  const done = ofRole.filter((d) => got.has(d.id)).length;
  const pct = ofRole.length ? Math.round((done / ofRole.length) * 100) : 0;
  const tierOf = (id: string) => profile.catalog.find((d) => d.id === id)?.tier;
  return (
    <Box ref={ref} component="section" sx={{ borderRadius: 3, bgcolor: green.deepest, color: chrome.text, p: { xs: 2.25, sm: 3 }, display: 'flex', flexWrap: 'wrap', gap: { xs: 2, sm: 3 }, alignItems: 'center', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 300px', minWidth: 0 }}>
        <LevelRing level={<Count value={lvl.level} shown={shown} duration={900} />} fraction={lvl.into / lvl.next} shown={shown} size={72} track={chrome.active} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h1" noWrap sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: { xs: '1.375rem', sm: '1.75rem' } }}>{name}</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: chrome.textSoft, fontVariantNumeric: 'tabular-nums' }}>
            <Count value={total} shown={shown} duration={1200} /> {tr('pontos · faltam ', 'points · ')}{lvl.next - lvl.into} {tr('para o nível ', 'to level ')}{lvl.level + 1}
          </Typography>
          {hasGm && (
            <Typography sx={{ fontSize: '0.75rem', color: chrome.textMuted, fontVariantNumeric: 'tabular-nums' }}>
              {tr('Jogador', 'Player')} {profile.points.player} pts · {tr('Mestre', 'Game master')} {profile.points.gm} pts
            </Typography>
          )}
          <Box sx={{ mt: 1, display: 'flex' }}><Bar fraction={lvl.into / lvl.next} shown={shown} track={chrome.active} fill={gold.bright} delay={300} /></Box>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2.5 }, flexWrap: 'wrap' }}>
        {TIER_ORDER.map((tier, i) => (
          <Box key={tier} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ...reveal(shown, i + 2) }}>
            <TrophyMedal tier={tier} size={28} />
            <Box>
              <Typography sx={{ fontFamily: displayFont, fontWeight: 700, lineHeight: 1 }}>
                <Count value={profile.unlocked.filter((u) => tierOf(u.id) === tier).length} shown={shown} />
              </Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: chrome.textSoft }}>{TROPHY_TIERS[tier].label}</Typography>
            </Box>
          </Box>
        ))}
        <Box sx={{ pl: { sm: 1 }, ...reveal(shown, 6) }}>
          <Typography sx={{ fontFamily: displayFont, fontWeight: 700, lineHeight: 1 }}><Count value={pct} shown={shown} />%</Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: chrome.textSoft }}>{done} {tr('de ', 'of ')}{ofRole.length}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

type RoleView = 'all' | TrophyRole;

/** Uma categoria da coleção: cabeçalho com o progresso, os troféus ganhos em cartões e os secretos numa prateleira. */
function Section({ role, category, defs, unlocked, profile, mine, fresh, missing, tagRole, onReplay }: {
  role: TrophyRole; category: string; defs: TrophyDef[]; unlocked: Map<string, Unlocked>; profile: TrophyProfile
  mine: boolean; fresh: Set<string>; missing: boolean; tagRole: boolean; onReplay: (def: TrophyDef) => void
}) {
  const [ref, shown] = useInView<HTMLDivElement>();
  const reduced = useReducedMotion();
  const byTier = (a: TrophyDef, b: TrophyDef) => TIER_POINTS[b.tier] - TIER_POINTS[a.tier];
  const got = defs.filter((d) => unlocked.has(d.id)).sort((a, b) => Number(fresh.has(b.id)) - Number(fresh.has(a.id)) || byTier(a, b));
  const locked = defs.filter((d) => !unlocked.has(d.id)).sort(byTier);
  const points = got.reduce((sum, d) => sum + TIER_POINTS[d.tier], 0);
  const complete = locked.length === 0;
  // O emblema da categoria veste o melhor grau já ganho nela.
  const best = got.length ? [...got].sort(byTier)[0].tier : null;
  const title = `${CATEGORIES[category] ?? category}${tagRole ? ` · ${role === 'gm' ? tr('Mestre', 'Game master') : tr('Jogador', 'Player')}` : ''}`;
  return (
    <Box ref={ref} component="section" sx={{ ...card, borderColor: complete ? gold.bright : rule, overflow: 'hidden', ...reveal(shown) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 1.5, sm: 2.5 }, py: 1.5, bgcolor: parchment.sunken, borderBottom: `1px solid ${rule}` }}>
        <Box sx={{ flexShrink: 0, transform: shown || reduced ? 'none' : 'scale(0.4) rotate(-30deg)', transition: `transform 700ms ${EASE_BACK} 120ms` }}>
          <TrophyMedal tier={best ?? 'bronze'} category={category} size={44} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 1 }}>
            <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.25 }}>{title}</Typography>
            {CATEGORY_BLURBS[category] && (
              <Typography sx={{ flexBasis: '100%', fontSize: '0.8125rem', color: ink.secondary, lineHeight: 1.35, order: 3 }}>{CATEGORY_BLURBS[category]}</Typography>
            )}
            <Typography sx={{ flexShrink: 0, fontSize: '0.8125rem', fontWeight: 700, color: complete ? gold.deep : ink.secondary, fontVariantNumeric: 'tabular-nums' }}>
              {complete ? tr('Completa! ', 'Complete! ') : ''}<Count value={got.length} shown={shown} />/{defs.length}{points ? ` · ${points} pts` : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', mt: 0.75 }}><Bar fraction={got.length / defs.length} shown={shown} track={parchment.page} fill={complete ? gold.bright : gold.main} delay={200} /></Box>
        </Box>
      </Box>
      <Box sx={{ p: { xs: 1.5, sm: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!missing && got.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 1.5 }}>
            {got.map((d, i) => {
              const u = unlocked.get(d.id)!;
              return (
                <TrophyCard key={d.id} def={d} at={u.at} mesa={u.mesa} progress={profile.progress[d.id] ?? 0}
                  mine={mine} fresh={fresh.has(d.id)} shown={shown} index={i} onReplay={onReplay} />
              );
            })}
          </Box>
        )}
        {locked.length > 0 && (
          <Box>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ink.secondary, mb: 1 }}>
              {locked.length} {locked.length === 1 ? tr('secreto por descobrir', 'secret to discover') : tr('secretos por descobrir', 'secrets to discover')}
            </Typography>
            {/* A prateleira: o secreto só mostra a forma do grau. Tentar espiar faz o cadeado sacudir. */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 1 }}>
              {locked.map((d, i) => (
                <Box key={d.id} title={`${tr('Troféu secreto', 'Secret trophy')} · ${TROPHY_TIERS[d.tier].label}`} sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, py: 0.75, borderRadius: 2,
                  ...reveal(shown, i + got.length),
                  ...(reduced ? {} : { '&:hover > svg, &:active > svg': { animation: `${lockWiggle} 520ms ease-in-out` } }),
                }}>
                  <TrophyMedal tier={d.tier} locked size={44} />
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TROPHY_TIERS[d.tier].ink }}>
                    {TROPHY_TIERS[d.tier].label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function Collection({ profile, mine, hasGm, fresh, onReplay }: { profile: TrophyProfile; mine: boolean; hasGm: boolean; fresh: Set<string>; onReplay: (def: TrophyDef) => void }) {
  // Quem mestra vê os dois conjuntos juntos; os botões separam.
  const [view, setView] = useState<RoleView>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const unlocked = useMemo(() => new Map(profile.unlocked.map((u) => [u.id, u])), [profile]);
  const inView = (d: TrophyDef) => (hasGm ? view === 'all' || d.role === view : d.role === 'player');
  const visible = profile.catalog.filter(inView);
  const categories = [...new Set(visible.map((d) => d.category))];
  // Uma seção por papel + categoria, na ordem do catálogo (a "Platina" existe nos dois papéis).
  const groups: { role: TrophyRole; category: string; defs: TrophyDef[] }[] = [];
  for (const d of visible) {
    if (category && d.category !== category) continue;
    const g = groups.find((x) => x.role === d.role && x.category === d.category);
    if (g) g.defs.push(d); else groups.push({ role: d.role, category: d.category, defs: [d] });
  }
  const shownGroups = groups.filter((g) => !missing || g.defs.some((d) => !unlocked.has(d.id)));
  const ROLE_LABEL: Record<RoleView, string> = { all: tr('Todos', 'All'), player: tr('Jogador', 'Player'), gm: tr('Mestre', 'Game master') };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {hasGm && (
          <Box role="group" aria-label={tr('Conjunto de troféus', 'Trophy set')} sx={{ display: 'inline-flex', alignSelf: 'flex-start', p: 0.5, borderRadius: 99, bgcolor: parchment.sunken, border: `1px solid ${rule}` }}>
            {(['all', 'player', 'gm'] as const).map((r) => {
              const n = profile.catalog.filter((d) => (r === 'all' || d.role === r) && unlocked.has(d.id)).length;
              return (
                <ButtonBase key={r} aria-pressed={view === r} onClick={() => { setView(r); setCategory(null); }} sx={{
                  px: { xs: 1, sm: 2 }, minHeight: 36, borderRadius: 99, whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.875rem', font: 'inherit',
                  color: view === r ? chrome.text : ink.primary, bgcolor: view === r ? green.deepest : 'transparent', transition: 'background-color 200ms ease',
                }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>{ROLE_LABEL[r]}</Box>
                  <Box component="span" sx={{ ml: 0.75, fontSize: '0.75rem', color: view === r ? gold.bright : ink.secondary, fontVariantNumeric: 'tabular-nums' }}>{n}</Box>
                </ButtonBase>
              );
            })}
          </Box>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip label={tr('Todas as categorias', 'All categories')} variant={category ? 'outlined' : 'filled'} onClick={() => setCategory(null)} />
          {categories.map((c) => (
            <Chip key={c} label={CATEGORIES[c] ?? c} variant={category === c ? 'filled' : 'outlined'} onClick={() => setCategory(c)} />
          ))}
          <Chip label={tr("Só os que faltam", 'Only the missing ones')} variant={missing ? 'filled' : 'outlined'} onClick={() => setMissing((m) => !m)} />
        </Box>
      </Box>
      {shownGroups.length === 0 && <Typography color="text.secondary">{tr('Nenhum troféu neste filtro.', 'No trophies in this filter.')}</Typography>}
      {shownGroups.map((g) => (
        <Section key={`${g.role}/${g.category}`} role={g.role} category={g.category} defs={g.defs} unlocked={unlocked} profile={profile}
          mine={mine} fresh={fresh} missing={missing} tagRole={hasGm && view === 'all' && g.category === 'platina'} onReplay={onReplay} />
      ))}
    </Box>
  );
}

export default function TrophiesPage() {
  const { user } = useParams();
  const role = useRole();
  const mine = !user || user === role.userId;
  const [tab, setTab] = useState<'mine' | 'mesa'>('mine');
  const [profile, setProfile] = useState<TrophyProfile | null | undefined>(undefined);
  const [ranking, setRanking] = useState<RankingEntry[] | null | undefined>(undefined);
  const [version, setVersion] = useState(0);
  const fresh = useFreshIds(mine ? role.userId : null, profile ? profile.unlocked.map((u) => u.id) : null);
  // Rever um desbloqueio: a mesma cerimônia do aviso, sem o ato do nível e sem tempo para fechar.
  const [replay, setReplay] = useState<UnlockToast | null>(null);
  const [leaving, setLeaving] = useState(false);
  const closeReplay = () => {
    setLeaving(true);
    window.setTimeout(() => { setLeaving(false); setReplay(null); }, 260);
  };

  // Troféu novo chegando (meu ou de alguém) relê o que está na tela.
  useEffect(() => onTableEvent((kind) => { if (kind === 'trophy-unlocked') setVersion((v) => v + 1); }), []);

  useEffect(() => {
    let alive = true;
    void fetchTrophyProfile(mine ? 'me' : user!).then((p) => { if (alive) setProfile(p); });
    void fetchTrophyRanking().then((r) => { if (alive) setRanking(r); });
    return () => { alive = false; };
  }, [mine, user, version]);

  const entry = ranking?.find((e) => e.userId === (mine ? role.userId : user));
  const name = mine ? (role.displayName ?? role.username ?? tr('Você', 'You')) : entry?.name ?? tr('Membro da mesa', 'Table member');
  const showTab = mine ? tab : 'mine';
  // Tem conjunto de mestre quem mestra esta mesa ou já pontuou mestrando outra.
  const hasGm = (mine ? role.isGm : entry?.role === 'gm') || (profile?.points.gm ?? 0) > 0;

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        {!mine && (
          <ButtonBase component={Link} to="/trofeus" aria-label={tr("Voltar aos meus troféus", 'Back to my trophies')} sx={{ width: 44, height: 44, borderRadius: 1.5, border: `1px solid ${rule}` }}>
            <BackIcon />
          </ButtonBase>
        )}
        <TrophyIcon sx={{ color: gold.deep }} />
        <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.25rem' }}>{tr('Troféus do Covil', 'Covil Trophies')}</Typography>
      </Box>

      {mine && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: `1px solid ${rule}` }}>
          <Tab value="mine" label={tr("Meus troféus", 'My trophies')} />
          <Tab value="mesa" label={tr('A mesa', 'The table')} />
        </Tabs>
      )}

      {showTab === 'mine' && (
        profile === undefined ? (
          <><Skeleton variant="rounded" height={130} /><Skeleton variant="rounded" height={320} /></>
        ) : profile === null ? (
          <Alert severity="warning">{tr('Não foi possível carregar os troféus agora.', 'Couldn\'t load the trophies right now.')}</Alert>
        ) : (
          <>
            <ProfileHeader name={name} profile={profile} hasGm={hasGm} />
            {mine && profile.unlocked.length === 0 && (
              <Alert severity="info" icon={<TrophyIcon />}>
                {tr('Todo mundo começa do zero. Escreva o background, anote o que acontece e role os dados com a sessão aberta pelo GM para ganhar os primeiros troféus.', 'Everyone starts from zero. Write your background, note down what happens and roll the dice with the session opened by the GM to earn the first trophies.')}</Alert>
            )}
            <Collection profile={profile} mine={mine} hasGm={hasGm} fresh={fresh}
              onReplay={(d) => setReplay({ key: `replay-${d.id}-${Date.now()}`, title: d.title, tier: d.tier, category: d.category, description: d.description, who: mine ? null : name })} />
          </>
        )
      )}

      {showTab === 'mesa' && (
        ranking === undefined ? <Skeleton variant="rounded" height={320} />
          : ranking === null ? <Alert severity="warning">{tr('Não foi possível carregar o ranking agora.', 'Couldn\'t load the ranking right now.')}</Alert>
            : <Ranking entries={ranking} me={role.userId} />
      )}

      {replay && (
        <Suspense fallback={null}>
          <TrophyCeremony key={replay.key} toast={replay} leaving={leaving} onClose={closeReplay} />
        </Suspense>
      )}
    </Box>
  );
}
