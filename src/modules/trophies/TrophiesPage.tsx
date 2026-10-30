import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, ButtonBase, Chip, Skeleton, Tab, Tabs, Typography } from '@mui/material';
import { ArrowBack as BackIcon, ChevronRight as ChevronIcon, EmojiEvents as TrophyIcon } from '@mui/icons-material';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { chrome, displayFont, gold, green, ink, parchment, rule, TROPHY_TIERS } from '../../theme';
import { useRole } from '../../services/auth';
import { MESAS } from '../../services/mesa';
import { onTableEvent } from '../../services/notifications';
import {
  fetchTrophyProfile, fetchTrophyRanking, levelOf, TIER_POINTS,
  type RankingEntry, type TrophyDef, type TrophyProfile, type TrophyRole, type TrophyTier,
} from '../../services/trophies';
import { initialsOf } from '../../layouts/navigation';
import { useInView } from '../../motion/useInView';
import { useReducedMotion } from '../../motion/motion';
import { useAnimatedNumber } from '../../motion/useAnimatedNumber';
import { TrophyMedal } from './TrophyMedal';
import { EASE, EASE_BACK, flash, glowNew, grow, reveal } from './motion';

// Troféus do Covil (`/trofeus`, `/trofeus/:user`): o perfil de troféus da conta — o meu ou o de
// um colega da mesa — e o ranking da mesa. O catálogo vem do servidor junto com o perfil.
//
// Animação (só apresenta; ver `motion.ts`): os cartões entram em cascata quando a grade aparece,
// o nível, os pontos e as contagens correm até o valor, as barras crescem, o troféu ganho desde a
// última visita respira com o selo "Novo" e o ranking desliza ao reordenar (FLIP).

const CATEGORIES: Record<string, string> = {
  ficha: 'Ficha', historia: 'História e notas', presenca: 'Presença', dados: 'Dados', destaques: 'Destaques da sessão',
  mesa: 'A mesa', mestre: 'Mestre', platina: 'Platina',
};
const TIER_ORDER: TrophyTier[] = ['platina', 'ouro', 'prata', 'bronze'];
const mesaName = (id: string | null) => MESAS.find((m) => m.id === id)?.nome ?? null;
const date = (at: number) => new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
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

function TrophyCard({ def, at, mesa, progress, mine, fresh, shown, index }: {
  def: TrophyDef; at: number | null; mesa: string | null; progress: number; mine: boolean; fresh: boolean; shown: boolean; index: number;
}) {
  const unlocked = at !== null;
  const secret = def.hidden && !unlocked;
  const tier = TROPHY_TIERS[def.tier];
  const reduced = useReducedMotion();
  return (
    <Box component="article" sx={{
      ...card, borderRadius: 2.5, p: 2, display: 'flex', gap: 1.75, alignItems: 'flex-start', position: 'relative',
      bgcolor: unlocked ? tier.tint : parchment.paper, borderColor: fresh ? gold.bright : unlocked ? tier.medal : rule,
      ...reveal(shown, index),
      ...(fresh && !reduced ? { animation: `${glowNew} 1600ms ease-in-out ${600 + Math.min(index, 16) * 45}ms 2` } : {}),
    }}>
      <Box sx={{
        transform: shown || reduced ? 'none' : 'scale(0.6) rotate(-18deg)',
        transition: `transform 640ms ${EASE_BACK}`, transitionDelay: `${120 + Math.min(index, 16) * 45}ms`,
      }}>
        <TrophyMedal tier={def.tier} locked={!unlocked} size={52} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
          <Typography component="h3" sx={{ fontWeight: 700, color: unlocked ? ink.primary : ink.secondary, lineHeight: 1.25 }}>
            {secret ? 'Troféu secreto' : def.title}
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', color: tier.ink, flexShrink: 0, textTransform: 'uppercase' }}>
            {fresh ? 'Novo!' : tier.label}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.875rem', color: ink.secondary, lineHeight: 1.45 }}>
          {secret ? (mine ? 'Continue jogando para descobrir.' : 'Ainda não descoberto.') : def.description}
        </Typography>
        {unlocked ? (
          <Typography sx={{ fontSize: '0.75rem', color: ink.secondary, mt: 0.25 }}>
            {date(at)}{mesaName(mesa) ? ` · ${mesaName(mesa)}` : ''}
          </Typography>
        ) : def.goal > 1 && !secret && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Bar fraction={progress / def.goal} shown={shown} delay={250 + Math.min(index, 16) * 45} />
            <Typography sx={{ fontSize: '0.75rem', color: ink.secondary, fontVariantNumeric: 'tabular-nums' }}>
              <Count value={progress} shown={shown} />/{def.goal}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function ProfileHeader({ name, profile, role }: { name: string; profile: TrophyProfile; role: TrophyRole }) {
  const [ref, shown] = useInView<HTMLDivElement>();
  const got = new Set(profile.unlocked.map((u) => u.id));
  const ofRole = profile.catalog.filter((d) => d.role === role);
  const total = profile.points.player + profile.points.gm;
  const lvl = levelOf(total);
  const done = ofRole.filter((d) => got.has(d.id)).length;
  const pct = ofRole.length ? Math.round((done / ofRole.length) * 100) : 0;
  const tierOf = (id: string) => profile.catalog.find((d) => d.id === id)?.tier;
  return (
    <Box ref={ref} component="section" sx={{ borderRadius: 3, bgcolor: green.deepest, color: chrome.text, p: { xs: 2.25, sm: 3 }, display: 'flex', flexWrap: 'wrap', gap: { xs: 2, sm: 3 }, alignItems: 'center', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 300px', minWidth: 0 }}>
        <Box sx={{
          width: 64, height: 64, borderRadius: '50%', bgcolor: gold.bright, color: green.deepest, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1,
          transform: shown ? 'none' : 'scale(0.5)', transition: `transform 700ms ${EASE_BACK}`,
        }}>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em' }}>NÍVEL</Typography>
          <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.625rem' }}><Count value={lvl.level} shown={shown} duration={900} /></Typography>
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h1" noWrap sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: { xs: '1.375rem', sm: '1.75rem' } }}>{name}</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: chrome.textSoft, fontVariantNumeric: 'tabular-nums' }}>
            <Count value={total} shown={shown} duration={1200} /> pontos · faltam {lvl.next - lvl.into} para o nível {lvl.level + 1}
          </Typography>
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
          <Typography sx={{ fontSize: '0.6875rem', color: chrome.textSoft }}>{done} de {ofRole.length}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

function Collection({ profile, mine, isGm, fresh }: { profile: TrophyProfile; mine: boolean; isGm: boolean; fresh: Set<string> }) {
  const hasGm = isGm || profile.points.gm > 0;
  const [role, setRole] = useState<TrophyRole>('player');
  const [category, setCategory] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [ref, shown] = useInView<HTMLDivElement>();
  const unlocked = useMemo(() => new Map(profile.unlocked.map((u) => [u.id, u])), [profile]);
  const list = profile.catalog
    .filter((d) => d.role === role && (!category || d.category === category) && (!missing || !unlocked.has(d.id)))
    .sort((a, b) => Number(fresh.has(b.id)) - Number(fresh.has(a.id))
      || Number(unlocked.has(b.id)) - Number(unlocked.has(a.id)) || TIER_POINTS[b.tier] - TIER_POINTS[a.tier]);
  const categories = [...new Set(profile.catalog.filter((d) => d.role === role).map((d) => d.category))];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {hasGm && (['player', 'gm'] as const).map((r) => (
          <Chip key={r} label={r === 'player' ? 'Jogador' : 'Mestre'} color={role === r ? 'primary' : 'default'}
            onClick={() => { setRole(r); setCategory(null); }} sx={{ fontWeight: 600 }} />
        ))}
        {hasGm && <Box sx={{ width: 8 }} />}
        <Chip label="Todos" variant={category ? 'outlined' : 'filled'} onClick={() => setCategory(null)} />
        {categories.map((c) => (
          <Chip key={c} label={CATEGORIES[c] ?? c} variant={category === c ? 'filled' : 'outlined'} onClick={() => setCategory(c)} />
        ))}
        <Chip label="Só os que faltam" variant={missing ? 'filled' : 'outlined'} onClick={() => setMissing((m) => !m)} />
      </Box>
      {list.length === 0 && <Typography color="text.secondary">Nenhum troféu neste filtro.</Typography>}
      <Box ref={ref} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 1.5 }}>
        {list.map((d, i) => {
          const u = unlocked.get(d.id);
          return (
            <TrophyCard key={d.id} def={d} at={u?.at ?? null} mesa={u?.mesa ?? null} progress={profile.progress[d.id] ?? 0}
              mine={mine} fresh={fresh.has(d.id)} shown={shown} index={i} />
          );
        })}
      </Box>
    </Box>
  );
}

/** Uma lista do ranking. Ao reordenar, as linhas deslizam até o lugar novo (FLIP). */
function RankList({ title, role, list, me }: { title: string; role: TrophyRole; list: RankingEntry[]; me: string | null }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [ref, shown] = useInView<HTMLDivElement>();
  const nodes = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());
  const points = useRef(new Map<string, number>());
  const [gained, setGained] = useState<Set<string>>(new Set());

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

  const top = Math.max(1, ...list.map((e) => e.points[role]));
  return (
    <Box ref={ref} component="section" sx={{ ...card, p: { xs: 1.5, sm: 2.5 } }}>
      <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.25rem', px: 1, pb: 1 }}>{title}</Typography>
      <Box sx={{ position: 'relative' }}>
        {list.map((e, i) => (
          <ButtonBase
            key={e.userId}
            ref={(el: HTMLButtonElement | null) => { if (el) nodes.current.set(e.userId, el); else nodes.current.delete(e.userId); }}
            onClick={() => navigate(e.userId === me ? '/trofeus' : `/trofeus/${e.userId}`)}
            sx={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 1.25, minHeight: 60, borderTop: `1px solid ${parchment.sunken}`,
              justifyContent: 'flex-start', textAlign: 'left', borderRadius: 1, bgcolor: e.userId === me ? `${gold.bright}1F` : 'transparent',
              ...reveal(shown, i),
              ...(gained.has(e.userId) && !reduced ? { animation: `${flash} 1600ms ease-out` } : {}),
            }}
          >
            <Typography sx={{ width: 24, fontFamily: displayFont, fontWeight: 700, color: i < 3 ? gold.deep : ink.secondary, textAlign: 'center' }}>{i + 1}</Typography>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: green.mid, color: chrome.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>
              {initialsOf(e.name)}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography noWrap sx={{ fontWeight: 600 }}>{e.name}{e.userId === me ? ' (você)' : ''}</Typography>
              <Box sx={{ display: 'flex', maxWidth: 240 }}><Bar fraction={e.points[role] / top} shown={shown} height={5} delay={200 + i * 60} /></Box>
              <Typography noWrap sx={{ fontSize: '0.8125rem', color: ink.secondary }}>
                {e.count} {e.count === 1 ? 'troféu' : 'troféus'}{e.platinum ? ` · ${e.platinum} platina` : ''}{e.last ? ` · último: ${e.last.title}` : ''}
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              <Count value={e.points[role]} shown={shown} duration={1100} />
            </Typography>
            <ChevronIcon sx={{ color: gold.deep }} />
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

function Ranking({ entries, me }: { entries: RankingEntry[]; me: string | null }) {
  const byName = (a: RankingEntry, b: RankingEntry) => a.name.localeCompare(b.name);
  const players = entries.filter((e) => e.points.player > 0 || e.role === 'player').sort((a, b) => b.points.player - a.points.player || byName(a, b));
  const masters = entries.filter((e) => e.role === 'gm' || e.points.gm > 0).sort((a, b) => b.points.gm - a.points.gm || byName(a, b));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {players.length > 0 && <RankList title="Jogadores" role="player" list={players} me={me} />}
      {masters.length > 0 && <RankList title="Mestres" role="gm" list={masters} me={me} />}
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

  // Troféu novo chegando (meu ou de alguém) relê o que está na tela.
  useEffect(() => onTableEvent((kind) => { if (kind === 'trophy-unlocked') setVersion((v) => v + 1); }), []);

  useEffect(() => {
    let alive = true;
    void fetchTrophyProfile(mine ? 'me' : user!).then((p) => { if (alive) setProfile(p); });
    void fetchTrophyRanking().then((r) => { if (alive) setRanking(r); });
    return () => { alive = false; };
  }, [mine, user, version]);

  const entry = ranking?.find((e) => e.userId === (mine ? role.userId : user));
  const name = mine ? (role.displayName ?? role.username ?? 'Você') : entry?.name ?? 'Membro da mesa';
  const showTab = mine ? tab : 'mine';

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        {!mine && (
          <ButtonBase component={Link} to="/trofeus" aria-label="Voltar aos meus troféus" sx={{ width: 44, height: 44, borderRadius: 1.5, border: `1px solid ${rule}` }}>
            <BackIcon />
          </ButtonBase>
        )}
        <TrophyIcon sx={{ color: gold.deep }} />
        <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.25rem' }}>Troféus do Covil</Typography>
      </Box>

      {mine && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: `1px solid ${rule}` }}>
          <Tab value="mine" label="Meus troféus" />
          <Tab value="mesa" label="A mesa" />
        </Tabs>
      )}

      {showTab === 'mine' && (
        profile === undefined ? (
          <><Skeleton variant="rounded" height={130} /><Skeleton variant="rounded" height={320} /></>
        ) : profile === null ? (
          <Alert severity="warning">Não foi possível carregar os troféus agora.</Alert>
        ) : (
          <>
            <ProfileHeader name={name} profile={profile} role="player" />
            {mine && profile.unlocked.length === 0 && (
              <Alert severity="info" icon={<TrophyIcon />}>
                Todo mundo começa do zero. Escreva o background, anote o que acontece e role os dados com a sessão aberta pelo GM para ganhar os primeiros troféus.
              </Alert>
            )}
            <Collection profile={profile} mine={mine} isGm={mine ? role.isGm : entry?.role === 'gm'} fresh={fresh} />
          </>
        )
      )}

      {showTab === 'mesa' && (
        ranking === undefined ? <Skeleton variant="rounded" height={320} />
          : ranking === null ? <Alert severity="warning">Não foi possível carregar o ranking agora.</Alert>
            : <Ranking entries={ranking} me={role.userId} />
      )}
    </Box>
  );
}
