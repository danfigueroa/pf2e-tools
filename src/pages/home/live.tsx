import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box, ButtonBase, Skeleton, Typography } from '@mui/material';
import {
  ArrowForward as ArrowIcon,
  Book as JournalIcon,
  ChevronRight as ChevronIcon,
  EmojiEvents as TrophyIcon,
  FormatListNumbered as InitiativeIcon,
  History as HistoryIcon,
  Map as MapIcon,
  PersonAdd as InviteIcon,
  PhoneIphone as ViewerIcon,
  Transform as TransformIcon,
  Whatshot as ScalerIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useRole } from '../../services/auth';
import { useTableRolls } from '../../services/rolls';
import { useCombatStatus, type CombatEntry } from '../../services/combatStatus';
import { useMapData } from '../../services/maps';
import { fetchDiarySummary } from '../../services/diary';
import { BASE_ACTIONS } from '../../modules/character-viewer/actions';
import { mergePeople, type DaySummary } from '../../modules/session-diary/stats';
import { computeAwards, shortDay } from '../../modules/session-diary/awards';
import { TokenBadge } from '../../modules/battle-map/components/TokenBadge';
import { rollHeadline, timeAgo } from '../../layouts/format';
import { initialsOf } from '../../layouts/navigation';
import {
  chrome, displayFont, gold, green, HP_COLOR, ink, ONLINE_BADGE, parchment, rule, status, TOKEN_NPC, TOKEN_PC,
} from '../../theme';
import { useParty, type PartyMember } from './party';
import { levelOf, useTrophySummary } from '../../services/trophies';
import { useInView } from '../../motion/useInView';
import { useAnimatedNumber } from '../../motion/useAnimatedNumber';
import { TrophyMedal } from '../../modules/trophies/TrophyMedal';
import { EASE_BACK } from '../../modules/trophies/motion';

// As partes VIVAS da Início, num chunk à parte (o estado da mesa, o mapa, o histórico e os
// helpers da ficha não entram no bundle principal). Cada parte tem o seu estado vazio honesto.

const card = { borderRadius: 3, bgcolor: parchment.paper, border: `1px solid ${rule}` };
const eyebrow = { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', color: gold.deep, textTransform: 'uppercase' as const };

const sheetLink = (slug: string) => `/ficha-virtual?ficha=${encodeURIComponent(slug)}`;
const firstName = (name: string) => name.split(/[\s,]/)[0];

const hpColor = (ratio: number) => (ratio > 0.5 ? status.success : HP_COLOR);

const HpBar = ({ current, max, height = 6, track = parchment.sunken }: { current: number; max: number; height?: number; track?: string }) => {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  return (
    <Box sx={{ height, borderRadius: 99, bgcolor: track, overflow: 'hidden' }} aria-hidden>
      <Box sx={{ width: `${ratio * 100}%`, height: '100%', bgcolor: hpColor(ratio), borderRadius: 99 }} />
    </Box>
  );
};

const Dot = ({ on, ring = parchment.paper }: { on: boolean; ring?: string }) => (
  <Box sx={{
    position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: '50%',
    bgcolor: on ? ONLINE_BADGE.dot : ink.disabled, border: `2px solid ${ring}`,
  }} />
);

const OnlineBadge = ({ online, total }: { online: number; total: number }) => (
  <Box component="span" sx={{
    display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.8125rem', fontWeight: 600, px: 1.5, py: 0.625,
    borderRadius: 99, bgcolor: online > 0 ? ONLINE_BADGE.bg : parchment.sunken, color: online > 0 ? ONLINE_BADGE.text : ink.secondary, whiteSpace: 'nowrap',
  }}>
    <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: online > 0 ? ONLINE_BADGE.dot : ink.disabled }} />
    {online} de {total} online
  </Box>
);

// --- O último dia de jogo (uma leitura só, compartilhada pelas partes) ----------------------

interface LastSession { day: string; rows: DaySummary[] }
let lastSessionRead: Promise<LastSession | null> | null = null;

function readLastSession(): Promise<LastSession | null> {
  lastSessionRead ??= fetchDiarySummary().then((all) => {
    if (!all || all.length === 0) return null;
    const day = all.reduce((max, r) => (r.day > max ? r.day : max), all[0].day);
    return { day, rows: all.filter((r) => r.day === day) };
  });
  return lastSessionRead;
}

/** `undefined` = lendo; `null` = nenhuma rolagem guardada. */
function useLastSession(): LastSession | null | undefined {
  const [state, setState] = useState<LastSession | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void readLastSession().then((s) => { if (alive) setState(s); });
    return () => { alive = false; };
  }, []);
  return state;
}

// --- Subtítulos vivos --------------------------------------------------------------------

/** "Rodada 3 · vez de Eldarion", "Encontro pronto", "Nenhum combate agora". */
function useCombatLine(): string {
  const combat = useCombatStatus();
  if (!combat) return 'Nenhum combate agora';
  if (combat.round <= 0) return 'Encontro pronto, ainda não começou';
  const current = combat.order.find((c) => c.id === combat.activeId);
  return `Rodada ${combat.round}${current ? ` · vez de ${firstName(current.name)}` : ''}`;
}

/** O nome do mapa onde a mesa está, ou null. */
function useMapName(): string | null {
  const combat = useCombatStatus();
  const { data } = useMapData(combat?.mapId ?? null);
  if (!combat?.mapId) return null;
  return data?.meta.name || 'Mapa da mesa';
}

// --- Topo do GM ---------------------------------------------------------------------------

/** "6 personagens no nível 10 · ninguém online agora". */
export function PartyLine() {
  const { members, ready } = useParty();
  if (!ready) return <Skeleton width={260} sx={{ bgcolor: chrome.raised }} />;
  const levels = members.map((m) => m.level);
  const common = levels.sort((a, b) => levels.filter((l) => l === b).length - levels.filter((l) => l === a).length)[0];
  const online = members.filter((m) => m.online).length;
  const left = members.length === 0
    ? 'Nenhuma ficha publicada ainda'
    : `${members.length} ${members.length === 1 ? 'personagem' : 'personagens'}${levels.every((l) => l === common) ? ` no nível ${common}` : ''}`;
  return <>{left} · {online === 0 ? 'ninguém online agora' : `${online} online agora`}</>;
}

const PrepareRow = ({ to, icon, title, text }: { to: string; icon: ReactNode; title: string; text: string }) => (
  <ButtonBase component={Link} to={to} sx={{
    display: 'flex', alignItems: 'center', gap: 1.75, px: 1.75, py: 1.5, minHeight: 52, borderRadius: 1.5,
    justifyContent: 'flex-start', textAlign: 'left', color: chrome.textSoft, '&:hover': { bgcolor: chrome.active },
    '& > svg:first-of-type': { color: gold.bright },
  }}>
    {icon}
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', color: chrome.text }}>{title}</Typography>
      <Typography noWrap sx={{ fontSize: '0.8125rem', color: chrome.textMuted }}>{text}</Typography>
    </Box>
    <ChevronIcon sx={{ color: chrome.textMuted }} />
  </ButtonBase>
);

/** "Preparar a sessão": os três passos do GM, cada um com o estado de agora. */
export function PrepareList() {
  const combatLine = useCombatLine();
  const combat = useCombatStatus();
  const mapName = useMapName();
  return (
    <Box sx={{ flex: '1 1 340px', minWidth: 0, borderRadius: 2.25, bgcolor: chrome.raised, p: 1, display: 'flex', flexDirection: 'column' }}>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', color: chrome.textMuted, px: 1.75, pt: 1.5, pb: 1 }}>
        PREPARAR A SESSÃO
      </Typography>
      <PrepareRow
        to="/iniciativa" icon={<InitiativeIcon />} title="Montar o encontro"
        text={combat ? `Iniciativa · ${combatLine.toLowerCase()}` : 'Iniciativa · nenhum encontro pronto'}
      />
      <PrepareRow
        to={combat?.mapId ? `/mapa/${combat.mapId}` : '/mapa'} icon={<MapIcon />} title="Escolher o mapa"
        text={`Mapa de Combate · ${mapName ?? 'nenhum mapa ativo'}`}
      />
      <PrepareRow to="/diario-campanha" icon={<JournalIcon />} title="Revisar o Diário" text="Diário de Campanha · preparação e notas" />
    </Box>
  );
}

// --- Seu personagem (jogador) -------------------------------------------------------------

const Stat = ({ label, children, sub }: { label: string; children: ReactNode; sub?: string }) => (
  <Box sx={{ borderRadius: 2, bgcolor: parchment.sunken, px: 2, py: 1.75, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: ink.secondary }}>{label}</Typography>
    {children}
    {sub && <Typography noWrap sx={{ fontSize: '0.8125rem', color: ink.secondary }}>{sub}</Typography>}
  </Box>
);

const bigNumber = { fontFamily: displayFont, fontWeight: 700, fontSize: '1.5rem', color: ink.primary, lineHeight: 1.1 };

/** O cartão do personagem da pessoa: PV, condições e a última rolagem. */
export function PlayerCard() {
  const { members, ready } = useParty();
  const { userId } = useRole();
  const { rolls } = useTableRolls();
  const mine = members.find((m) => userId && m.ownerId === userId) ?? null;
  const last = mine ? rolls.find((r) => r.slug === mine.slug) : undefined;
  const total = last ? rollHeadline(last) : null;

  if (!ready) return <Skeleton variant="rounded" height={260} sx={{ flex: '3 1 480px', borderRadius: 3 }} />;

  if (!mine) {
    return (
      <Box component="section" sx={{ ...card, flex: '3 1 480px', minWidth: 0, p: { xs: 2.5, sm: 3.25 }, display: 'flex', flexDirection: 'column', gap: 1.5, justifyContent: 'center' }}>
        <Typography sx={eyebrow}>Seu personagem</Typography>
        <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.5rem' }}>Nenhuma ficha sua ainda</Typography>
        <Typography sx={{ color: ink.secondary, lineHeight: 1.5 }}>
          Importe o personagem do Pathbuilder e publique pela Ficha Virtual: ele aparece aqui, com PV e condições ao vivo.
        </Typography>
        <ButtonBase component={Link} to="/ficha-virtual" sx={{
          alignSelf: 'flex-start', height: 48, px: 2.5, borderRadius: 1.75, bgcolor: green.deepest, color: chrome.text, fontWeight: 700, gap: 1.25,
        }}>
          Abrir a Ficha Virtual<ArrowIcon sx={{ color: gold.bright }} fontSize="small" />
        </ButtonBase>
      </Box>
    );
  }

  return (
    <Box component="section" aria-labelledby="home-personagem" sx={{ ...card, flex: '3 1 480px', minWidth: 0, p: { xs: 2.25, sm: 3.25 }, display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.75 } }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2.25 }}>
        <Box sx={{ borderRadius: '50%', boxShadow: `0 0 0 3px ${parchment.paper}, 0 0 0 5px ${gold.bright}`, flexShrink: 0, display: 'flex' }}>
          <TokenBadge slug={mine.slug} name={mine.name} size={64} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography sx={eyebrow}>Seu personagem</Typography>
          <Typography id="home-personagem" component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: { xs: '1.375rem', sm: '1.875rem' }, lineHeight: 1.15 }}>
            {mine.name}
          </Typography>
          <Typography sx={{ color: ink.secondary }}>{mine.className} · Nível {mine.level}</Typography>
        </Box>
        <ButtonBase component={Link} to={sheetLink(mine.slug)} sx={{
          height: 52, px: 2.75, borderRadius: 1.75, bgcolor: green.deepest, color: chrome.text, fontWeight: 700, gap: 1.25,
          width: { xs: '100%', sm: 'auto' },
        }}>
          Abrir minha ficha<ArrowIcon sx={{ color: gold.bright }} fontSize="small" />
        </ButtonBase>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1.5 }}>
        <Stat label="PONTOS DE VIDA">
          {mine.hp ? (
            <>
              <Typography sx={bigNumber}>
                {mine.hp.current}{mine.hp.temp > 0 ? ` +${mine.hp.temp}` : ''}{' '}
                <Box component="span" sx={{ fontFamily: 'inherit', fontWeight: 500, fontSize: '0.9375rem', color: ink.secondary }}>/ {mine.hp.max}</Box>
              </Typography>
              <HpBar current={mine.hp.current} max={mine.hp.max} track={parchment.page} />
            </>
          ) : <Skeleton height={44} />}
        </Stat>
        <Stat label="CONDIÇÕES" sub={mine.conditions.length > 2 ? `+${mine.conditions.length - 2}` : mine.conditions.length === 0 ? 'Pronto para a próxima' : undefined}>
          <Typography sx={{ fontWeight: 600, fontSize: '1.0625rem' }}>
            {mine.conditions.length === 0 ? 'Nenhuma' : mine.conditions.slice(0, 2).join(', ')}
          </Typography>
        </Stat>
        <Stat label="ÚLTIMA ROLAGEM" sub={last?.title}>
          {last && total !== null ? (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography sx={bigNumber}>{total}</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: ink.secondary }}>{timeAgo(last.at)}</Typography>
            </Box>
          ) : <Typography sx={{ color: ink.secondary }}>Nenhuma ainda</Typography>}
        </Stat>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px', fontWeight: 600 }}>
        <ButtonBase component={Link} to={sheetLink(mine.slug)} sx={{ minHeight: 44, gap: 1, color: gold.deep, fontWeight: 600 }}>
          <ViewerIcon fontSize="small" />Rolar uma perícia
        </ButtonBase>
        <ButtonBase component={Link} to="/ficha-virtual" sx={{ minHeight: 44, gap: 1, color: gold.deep, fontWeight: 600 }}>
          Reimportar do Pathbuilder
        </ButtonBase>
      </Box>
    </Box>
  );
}

// --- Acesso rápido ------------------------------------------------------------------------

interface QuickItem { to: string; icon: ReactNode; title: string; text: string; gm?: boolean; live?: boolean }

/** Os atalhos, cada um com uma linha viva. O GM ganha Fichas, Diário, Escalar Monstro e o convite. */
export function QuickAccess({ gm, members: memberCount }: { gm: boolean; members: number | null }) {
  const { members } = useParty();
  const combat = useCombatStatus();
  const combatLine = useCombatLine();
  const mapName = useMapName();
  const session = useLastSession();
  const { data: mapData } = useMapData(combat?.mapId ?? null);
  const inCombat = !!combat && combat.round > 0;
  const tokens = mapData ? Object.keys(mapData.tokens).length : null;

  const items: QuickItem[] = [
    ...(gm ? [{ to: '/ficha-virtual', icon: <ViewerIcon />, title: 'Fichas', text: `${members.length} ${members.length === 1 ? 'personagem' : 'personagens'}` }] : []),
    { to: '/iniciativa', icon: <InitiativeIcon />, title: 'Iniciativa', text: combatLine, live: inCombat },
    { to: combat?.mapId ? `/mapa/${combat.mapId}` : '/mapa', icon: <MapIcon />, title: 'Mapa de Combate', text: mapName ? `${mapName}${inCombat && tokens ? ` · ${tokens} tokens` : ''}` : 'Nenhum mapa ativo', live: inCombat && !!mapName },
    { to: '/historico', icon: <HistoryIcon />, title: 'Rolagens', text: session ? `Última sessão: ${shortDay(session.day)}` : 'Histórico da mesa' },
    { to: '/transformation', icon: <TransformIcon />, title: 'Transformações', text: 'Forma Animal, Elemental…' },
    ...(gm ? [
      { to: '/diario-campanha', icon: <JournalIcon />, title: 'Diário', text: 'Notas da campanha', gm: true },
      { to: '/escalar-monstro', icon: <ScalerIcon />, title: 'Escalar Monstro', text: 'Criaturas da AON', gm: true },
      { to: '/membros', icon: <InviteIcon />, title: 'Convidar jogador', text: memberCount !== null ? `${memberCount} ${memberCount === 1 ? 'membro' : 'membros'} na mesa` : 'Membros e convites', gm: true },
    ] : []),
  ];

  return (
    <Box component="section" aria-labelledby="home-atalhos" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography id="home-atalhos" component="h2" sx={{ ...eyebrow, fontSize: '0.8125rem' }}>Acesso rápido</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(auto-fill, minmax(240px, 1fr))' }, gap: { xs: 1.25, sm: 1.5 } }}>
        {items.map((it) => (
          <ButtonBase key={it.to + it.title} component={Link} to={it.to} sx={{
            ...card, borderRadius: 2.25, display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1.25, sm: 1.75 }, px: { xs: 1.75, sm: 2 }, py: { xs: 1.75, sm: 1.75 }, minHeight: { xs: 104, sm: 76 },
            justifyContent: 'flex-start', textAlign: 'left', color: ink.primary,
          }}>
            <Box sx={{
              width: { xs: 36, sm: 44 }, height: { xs: 36, sm: 44 }, borderRadius: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: it.gm ? parchment.sunken : green.deepest, color: it.gm ? ink.primary : gold.bright,
            }}>{it.icon}</Box>
            <Box sx={{ minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Typography sx={{ fontWeight: 600, fontSize: { xs: '0.9375rem', sm: '1rem' }, display: 'flex', alignItems: 'center', gap: 1 }}>
                {it.title}
                {it.live && (
                  <Box component="span" sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.04em', px: 0.75, py: 0.25, borderRadius: 0.75, bgcolor: ONLINE_BADGE.bg, color: ONLINE_BADGE.text }}>AO VIVO</Box>
                )}
                {it.gm && (
                  <Box component="span" sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.04em', px: 0.75, py: 0.25, borderRadius: 0.75, bgcolor: green.deepest, color: chrome.text }}>GM</Box>
                )}
              </Typography>
              <Typography noWrap sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' }, color: ink.secondary, maxWidth: '100%' }}>{it.text}</Typography>
            </Box>
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

// --- O grupo ------------------------------------------------------------------------------

const MemberRow = ({ member: m, playing }: { member: PartyMember; playing?: boolean }) => (
  <ButtonBase component={Link} to={sheetLink(m.slug)} sx={{
    display: 'flex', alignItems: 'center', gap: 1.75, py: 1.25, minHeight: 56, textAlign: 'left', justifyContent: 'flex-start',
    borderTop: `1px solid ${parchment.sunken}`, color: 'inherit', width: '100%',
  }}>
    <Box sx={{ position: 'relative', flexShrink: 0 }}>
      <TokenBadge slug={m.slug} name={m.name} size={40} />
      <Dot on={m.online} />
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{m.name}</Typography>
      <Typography noWrap sx={{ fontSize: '0.8125rem', color: ink.secondary }}>
        {[m.className, playing ? 'jogando agora' : `Nível ${m.level}`, ...m.conditions.slice(0, 2)].filter(Boolean).join(' · ')}
      </Typography>
    </Box>
    <Box sx={{ width: { xs: 96, sm: 140 }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0.625, alignItems: 'flex-end' }}>
      {m.hp ? (
        <>
          <Typography sx={{ fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', color: m.hp.current / m.hp.max <= 0.5 ? status.error : ink.secondary }}>
            {m.hp.current}{m.hp.temp > 0 ? ` +${m.hp.temp}` : ''} / {m.hp.max} PV
          </Typography>
          <Box sx={{ width: '100%' }}><HpBar current={m.hp.current} max={m.hp.max} /></Box>
        </>
      ) : <Skeleton width="100%" height={20} />}
    </Box>
  </ButtonBase>
);

const MemberTile = ({ member: m }: { member: PartyMember }) => (
  <ButtonBase component={Link} to={sheetLink(m.slug)} sx={{
    display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.25, minHeight: 60, borderRadius: 1.75,
    bgcolor: parchment.page, justifyContent: 'flex-start', textAlign: 'left', color: 'inherit', minWidth: 0,
  }}>
    <Box sx={{ position: 'relative', flexShrink: 0 }}>
      <TokenBadge slug={m.slug} name={m.name} size={36} />
      <Dot on={m.online} ring={parchment.page} />
    </Box>
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{m.name}</Typography>
      {m.hp ? <HpBar current={m.hp.current} max={m.hp.max} height={5} track={parchment.sunken} /> : <Skeleton height={5} />}
    </Box>
    {m.hp && <Typography sx={{ fontSize: '0.75rem', color: ink.secondary, fontVariantNumeric: 'tabular-nums' }}>{m.hp.current}/{m.hp.max}</Typography>}
  </ButtonBase>
);

/** O grupo: o GM vê uma lista com nível e PV; o jogador, uma grade de leitura. */
export function GroupSection({ gm }: { gm: boolean }) {
  const { members, ready } = useParty();
  const combat = useCombatStatus();
  const activeSlug = combat && combat.round > 0 ? combat.order.find((c) => c.id === combat.activeId)?.slug ?? null : null;
  const online = members.filter((m) => m.online).length;
  return (
    <Box component="section" aria-labelledby="home-grupo" sx={{ ...card, borderRadius: 2.75, flex: '3 1 440px', minWidth: 0, p: { xs: 2, sm: 3 }, pb: { xs: 1.5, sm: gm ? 1.5 : 3 }, display: 'flex', flexDirection: 'column', gap: gm ? 0.5 : 1.75 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, pb: gm ? 1 : 0 }}>
        <Typography id="home-grupo" component="h2" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.25rem' }}>O grupo</Typography>
        {gm
          ? members.length > 0 && <OnlineBadge online={online} total={members.length} />
          : <Typography sx={{ fontSize: '0.875rem', color: ink.secondary }}>Toque para ver a ficha (só leitura)</Typography>}
      </Box>
      {!ready && [0, 1, 2].map((i) => <Skeleton key={i} height={gm ? 56 : 60} />)}
      {ready && members.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          Nenhuma ficha publicada nesta mesa ainda. Cada jogador publica a sua pela Ficha Virtual.
        </Typography>
      )}
      {gm
        ? members.map((m) => <MemberRow key={m.slug} member={m} playing={m.slug === activeSlug} />)
        : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.25 }}>
            {members.map((m) => <MemberTile key={m.slug} member={m} />)}
          </Box>
        )}
    </Box>
  );
}

// --- A última sessão ----------------------------------------------------------------------

const RollLine = ({ title, sub, value, color, avatar }: { title: string; sub: string; value: number | null; color?: string; avatar?: string }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderTop: `1px solid ${parchment.sunken}` }}>
    {avatar && (
      <Box sx={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 700, color: chrome.onAccent, bgcolor: color ?? green.mid }}>{avatar}</Box>
    )}
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography noWrap sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{title}</Typography>
      <Typography noWrap sx={{ fontSize: '0.75rem', color: ink.secondary }}>{sub}</Typography>
    </Box>
    {value !== null && <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.375rem' }}>{value}</Typography>}
  </Box>
);

const HistoryLink = ({ children }: { children: ReactNode }) => (
  <ButtonBase component={Link} to="/historico" sx={{ height: 46, borderRadius: 1.5, border: `1px solid ${rule}`, fontWeight: 600, gap: 1, mt: 'auto' }}>
    {children}<ArrowIcon fontSize="small" />
  </ButtonBase>
);

/** A última sessão da mesa (GM) ou a do jogador: troféu, média do d20 e as rolagens mais recentes. */
export function LastSessionSection({ gm, inCombat = false }: { gm: boolean; inCombat?: boolean }) {
  const session = useLastSession();
  const { rolls } = useTableRolls();
  const { members } = useParty();
  const { userId } = useRole();
  const mine = members.find((m) => userId && m.ownerId === userId) ?? null;

  const view = useMemo(() => {
    if (!session) return null;
    const checks = session.rows.reduce((n, r) => n + r.checks, 0);
    const sum = session.rows.reduce((n, r) => n + r.d20Sum, 0);
    const awards = computeAwards(mergePeople(session.rows), 'session').filter((a) => a.winner);
    return { avg: checks ? sum / checks : null, awards };
  }, [session]);

  // O troféu: o da mesa (a máquina de dano, senão o primeiro) ou o que é DESTA pessoa.
  const trophy = useMemo(() => {
    if (!view) return null;
    if (gm) return view.awards.find((a) => a.id === 'engine') ?? view.awards[0] ?? null;
    return view.awards.find((a) => mine && a.winner?.person.slug === mine.slug) ?? null;
  }, [view, gm, mine]);

  const list = (gm ? rolls : rolls.filter((r) => mine && r.slug === mine.slug)).slice(0, inCombat ? 4 : 3);

  return (
    <Box component="section" aria-labelledby="home-ultima" sx={{ ...card, borderRadius: 2.75, flex: '2 1 320px', minWidth: 0, p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1.5 }}>
        <Typography id="home-ultima" component="h2" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.25rem' }}>
          {inCombat ? 'Rolagens ao vivo' : gm ? 'Última sessão' : 'Sua última sessão'}
        </Typography>
        {inCombat
          ? <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.8125rem', fontWeight: 600, color: ONLINE_BADGE.text }}><Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ONLINE_BADGE.dot }} />agora</Box>
          : session && <Typography sx={{ fontSize: '0.875rem', color: ink.secondary }}>{shortDay(session.day)}</Typography>}
      </Box>

      {!inCombat && session === undefined && <Skeleton variant="rounded" height={120} />}
      {!inCombat && session === null && (
        <Typography variant="body2" color="text.secondary">
          Nenhuma rolagem guardada ainda. Com a sessão iniciada, a primeira noite aparece aqui.
        </Typography>
      )}

      {view && !inCombat && (
        <>
          {gm ? (
            <Box sx={{ display: 'flex', gap: 1.25 }}>
              <Box sx={{ flex: 1, borderRadius: 1.75, bgcolor: parchment.sunken, px: 1.75, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: ink.secondary }}>MÉDIA DO D20</Typography>
                <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.75rem' }}>
                  {view.avg !== null ? view.avg.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—'}
                </Typography>
              </Box>
              {trophy?.winner && (
                <Box sx={{ flex: 1.4, minWidth: 0, borderRadius: 1.75, bgcolor: green.deepest, px: 1.75, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  <Typography noWrap sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: gold.bright }}>
                    <TrophyIcon sx={{ fontSize: 15 }} />{trophy.title.toUpperCase()}
                  </Typography>
                  <Typography noWrap sx={{ fontWeight: 600, color: chrome.text }}>{firstName(trophy.winner.person.name)} · {trophy.winner.label}</Typography>
                </Box>
              )}
            </Box>
          ) : trophy?.winner && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, borderRadius: 2, bgcolor: green.deepest, px: 2, py: 1.5 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: 1.5, bgcolor: chrome.active, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TrophyIcon sx={{ color: gold.bright }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: gold.bright }}>VOCÊ LEVOU UM TROFÉU</Typography>
                <Typography noWrap sx={{ fontWeight: 600, color: chrome.text }}>{trophy.title} · {trophy.winner.label}</Typography>
              </Box>
            </Box>
          )}
        </>
      )}

      <Box>
        {!inCombat && <Typography sx={{ ...eyebrow, fontSize: '0.75rem', pb: 0.75 }}>{gm ? 'Últimas rolagens' : 'Suas rolagens'}</Typography>}
        {list.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ borderTop: `1px solid ${parchment.sunken}`, pt: 1.5 }}>
            {gm ? 'Ninguém rolou ainda.' : mine ? 'Você ainda não rolou nada.' : 'Publique uma ficha para rolar pela mesa.'}
          </Typography>
        )}
        {list.map((r) => (
          <RollLine
            key={r.id} title={r.title} value={rollHeadline(r)} color={r.color}
            avatar={gm ? initialsOf(r.by) : undefined}
            sub={gm ? `${r.by} · ${timeAgo(r.at)}` : timeAgo(r.at)}
          />
        ))}
      </Box>
      <HistoryLink>{inCombat ? 'Ver todas de hoje' : gm ? 'Ver histórico completo' : 'Ver histórico da mesa'}</HistoryLink>
    </Box>
  );
}

// --- Durante o combate --------------------------------------------------------------------

/** A ordem a partir de `fromId` (circular), sem ele. */
function rotated(order: CombatEntry[], fromId: string | null): CombatEntry[] {
  const i = Math.max(0, order.findIndex((c) => c.id === fromId));
  return [...order.slice(i), ...order.slice(0, i)];
}

const OrderRow = ({ entry, active, hp, tag }: { entry: CombatEntry; active?: boolean; hp: { current: number; max: number } | null; tag?: string }) => (
  <Box sx={{
    display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.125, borderRadius: 1.5, minHeight: 48,
    bgcolor: active ? green.deepest : 'transparent', color: active ? chrome.text : ink.primary, opacity: entry.defeated ? 0.55 : 1,
    boxShadow: active ? `0 0 0 2px ${gold.bright}` : 'none',
  }}>
    <Box sx={{
      width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.6875rem', fontWeight: 700, color: chrome.onAccent, bgcolor: entry.kind === 'npc' ? TOKEN_NPC : TOKEN_PC,
    }}>{initialsOf(entry.name)}</Box>
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.875rem', textDecoration: entry.defeated ? 'line-through' : 'none' }}>
        {entry.name}{tag && <Box component="span" sx={{ fontWeight: 400, color: active ? chrome.textMuted : ink.secondary }}> · {tag}</Box>}
      </Typography>
      {hp && !active && <Box sx={{ maxWidth: 160 }}><HpBar current={hp.current} max={hp.max} height={5} /></Box>}
    </Box>
    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{entry.initiative}</Typography>
  </Box>
);

const Pips = ({ left }: { left: number }) => (
  <Box sx={{ display: 'flex', gap: 0.75 }} role="img" aria-label={`${left} de ${BASE_ACTIONS} ações restantes`}>
    {Array.from({ length: BASE_ACTIONS }, (_, i) => (
      <Box key={i} sx={{ width: 12, height: 12, transform: 'rotate(45deg)', boxSizing: 'border-box', bgcolor: i < left ? gold.bright : 'transparent', border: `2px solid ${gold.bright}` }} />
    ))}
  </Box>
);

/** O combate do GM: de quem é a vez, a ordem e os atalhos (o turno passa pela Iniciativa). */
export function GmCombat() {
  const combat = useCombatStatus();
  const { members } = useParty();
  if (!combat || combat.round <= 0) return null;
  const active = combat.order.find((c) => c.id === combat.activeId);
  const pc = active?.slug ? members.find((m) => m.slug === active.slug) : null;
  const hp = pc?.hp ?? active?.hp ?? null;
  const list = rotated(combat.order, combat.activeId);
  const index = Math.max(0, combat.order.findIndex((c) => c.id === combat.activeId)) + 1;
  const shown = list.slice(0, 6);
  const hpOf = (c: CombatEntry) => (c.slug ? members.find((m) => m.slug === c.slug)?.hp ?? null : c.hp);
  return (
    <Box component="section" aria-labelledby="home-vez" sx={{ borderRadius: 3, bgcolor: chrome.hero, color: chrome.textSoft, p: { xs: 2.25, sm: 3.5 }, display: 'flex', flexWrap: 'wrap', gap: 3.5 }}>
      <Box sx={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', color: gold.bright }}>RODADA {combat.round} · TURNO {index} DE {combat.order.length}</Typography>
        {active && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: displayFont, fontWeight: 700, fontSize: '1.125rem', color: chrome.onAccent, bgcolor: active.kind === 'npc' ? TOKEN_NPC : TOKEN_PC, boxShadow: `0 0 0 3px ${chrome.hero}, 0 0 0 5px ${gold.bright}` }}>
              {initialsOf(active.name)}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', color: chrome.textSoft }}>É A VEZ DE</Typography>
              <Typography id="home-vez" component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: { xs: '1.5rem', sm: '1.875rem' }, color: chrome.text, lineHeight: 1.15 }}>{active.name}</Typography>
              {hp && <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>{hp.current} / {hp.max} PV</Typography>}
            </Box>
            {pc?.actions && <Box sx={{ ml: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.75 }}>
              <Pips left={Math.max(0, BASE_ACTIONS - pc.actions.used)} />
              <Typography sx={{ fontSize: '0.75rem' }}>{Math.max(0, BASE_ACTIONS - pc.actions.used)} ações</Typography>
            </Box>}
          </Box>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 'auto' }}>
          <ButtonBase component={Link} to="/iniciativa" sx={{ height: 48, px: 2.5, borderRadius: 1.5, bgcolor: gold.bright, color: green.deepest, fontWeight: 700, gap: 1.25, '&:hover': { bgcolor: gold.main } }}>
            Abrir iniciativa<ArrowIcon fontSize="small" />
          </ButtonBase>
          <ButtonBase component={Link} to={combat.mapId ? `/mapa/${combat.mapId}` : '/mapa'} sx={{ height: 48, px: 2.25, borderRadius: 1.5, border: `1px solid ${chrome.lineStrong}`, color: chrome.text, fontWeight: 600 }}>
            Abrir mapa
          </ButtonBase>
        </Box>
      </Box>
      <Box sx={{ flex: '1 1 340px', minWidth: 0, borderRadius: 2.25, bgcolor: parchment.paper, color: ink.primary, p: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1.5, pt: 1, pb: 0.75, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: ink.secondary }}>
          <span>ORDEM</span><span>INIC.</span>
        </Box>
        {shown.map((c) => <OrderRow key={c.id} entry={c} active={c.id === combat.activeId} hp={hpOf(c)} tag={c.id === combat.activeId ? 'agora' : undefined} />)}
        {list.length > shown.length && (
          <ButtonBase component={Link} to="/iniciativa" sx={{ minHeight: 44, fontWeight: 600, fontSize: '0.875rem', color: gold.deep }}>
            + {list.length - shown.length} na fila · ver todos
          </ButtonBase>
        )}
      </Box>
    </Box>
  );
}

/** O combate do jogador: "É a sua vez" (ou de quem é) com PV e ações, e quem age depois. */
export function PlayerCombat() {
  const combat = useCombatStatus();
  const { members } = useParty();
  const { userId } = useRole();
  if (!combat || combat.round <= 0) return null;
  const mine = members.find((m) => userId && m.ownerId === userId) ?? null;
  const active = combat.order.find((c) => c.id === combat.activeId);
  const myTurn = !!mine && active?.slug === mine.slug;
  const from = mine ? combat.order.find((c) => c.slug === mine.slug)?.id ?? combat.activeId : combat.activeId;
  const after = rotated(combat.order, from).slice(1, 5);
  const hpOf = (c: CombatEntry) => (c.slug ? members.find((m) => m.slug === c.slug)?.hp ?? null : c.hp);
  const left = Math.max(0, BASE_ACTIONS - (mine?.actions?.used ?? 0));
  return (
    <Box sx={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box component="section" aria-labelledby="home-vez" sx={{
        borderRadius: 3, bgcolor: chrome.hero, color: chrome.textSoft, p: { xs: 2.25, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2,
        boxShadow: myTurn ? `inset 0 0 0 2px ${gold.bright}` : 'none',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {mine && <Box sx={{ borderRadius: '50%', boxShadow: `0 0 0 3px ${chrome.hero}, 0 0 0 5px ${gold.bright}`, display: 'flex' }}><TokenBadge slug={mine.slug} name={mine.name} size={54} /></Box>}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', color: myTurn ? gold.bright : chrome.textSoft }}>
              {myTurn ? 'É A SUA VEZ' : `COMBATE · RODADA ${combat.round}`}
            </Typography>
            <Typography id="home-vez" component="h2" noWrap sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.5rem', color: chrome.text }}>
              {mine ? mine.name : active ? `Vez de ${active.name}` : 'Combate'}
            </Typography>
            {!myTurn && active && mine && <Typography sx={{ fontSize: '0.875rem' }}>Agora: {active.name}</Typography>}
          </Box>
          {myTurn && mine && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.75 }}>
              <Pips left={left} /><Typography sx={{ fontSize: '0.75rem' }}>{left} ações</Typography>
            </Box>
          )}
        </Box>
        {mine?.hp && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 600 }}>
              <Box component="span" sx={{ color: chrome.textMuted }}>PONTOS DE VIDA</Box>
              <Box component="span" sx={{ color: chrome.text, fontVariantNumeric: 'tabular-nums' }}>{mine.hp.current} / {mine.hp.max}</Box>
            </Box>
            <HpBar current={mine.hp.current} max={mine.hp.max} height={8} track={green.deepest} />
          </Box>
        )}
        <ButtonBase component={Link} to={mine ? sheetLink(mine.slug) : '/iniciativa'} sx={{ height: 50, borderRadius: 1.75, bgcolor: gold.bright, color: green.deepest, fontWeight: 700, gap: 1.25, '&:hover': { bgcolor: gold.main } }}>
          {mine ? 'Abrir minha ficha' : 'Abrir iniciativa'}<ArrowIcon fontSize="small" />
        </ButtonBase>
      </Box>
      <Box component="section" aria-labelledby="home-depois" sx={{ ...card, borderRadius: 2.5, p: { xs: 1.75, sm: 2.5 }, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0.75 }}>
          <Typography id="home-depois" component="h2" sx={{ ...eyebrow }}>{mine ? 'Depois de você' : 'Próximos'}</Typography>
          <ButtonBase component={Link} to="/iniciativa" sx={{ minHeight: 40, fontSize: '0.8125rem', fontWeight: 600, color: gold.deep }}>Ver ordem completa</ButtonBase>
        </Box>
        {after.map((c, i) => {
          const hp = hpOf(c);
          return (
            <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.125, borderTop: `1px solid ${parchment.sunken}` }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 700, color: chrome.onAccent, bgcolor: c.kind === 'npc' ? TOKEN_NPC : TOKEN_PC }}>{initialsOf(c.name)}</Box>
              <Typography noWrap sx={{ flex: 1, fontWeight: 600, fontSize: '0.875rem', textDecoration: c.defeated ? 'line-through' : 'none' }}>{c.name}</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: hp && hp.current / hp.max <= 0.35 ? status.error : ink.secondary, fontVariantNumeric: 'tabular-nums' }}>
                {i === 0 && !mine ? 'próximo' : c.kind === 'pc' && hp ? `${hp.current}/${hp.max}` : c.kind === 'npc' ? 'NPC' : ''}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// --- Troféus ------------------------------------------------------------------------------

/** A vitrine dos troféus da pessoa: nível, pontos e os últimos ganhos, com a entrada animada. */
export function TrophyShowcase() {
  const summary = useTrophySummary();
  const [ref, shown] = useInView<HTMLAnchorElement>();
  const total = summary ? summary.points.player + summary.points.gm : 0;
  const lvl = levelOf(total);
  const points = useAnimatedNumber(shown ? total : 0, { duration: 1100 });
  if (!summary) return <Skeleton variant="rounded" height={96} sx={{ borderRadius: 3 }} />;
  return (
    <ButtonBase ref={ref} component={Link} to="/trofeus" aria-label="Abrir os meus troféus" sx={{
      ...card, borderRadius: 2.75, width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 1.5, sm: 2.5 },
      p: { xs: 1.75, sm: 2.25 }, justifyContent: 'flex-start', textAlign: 'left', color: ink.primary,
    }}>
      <Box sx={{
        width: 52, height: 52, borderRadius: '50%', bgcolor: green.deepest, color: gold.bright, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        transform: shown ? 'none' : 'scale(0.5) rotate(-30deg)', transition: `transform 700ms ${EASE_BACK}`,
      }}>
        <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em' }}>NÍVEL</Typography>
        <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.25rem', color: chrome.text }}>{lvl.level}</Typography>
      </Box>
      <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
        <Typography sx={eyebrow}>Troféus do Covil</Typography>
        <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {points} pontos · {summary.count} de {summary.total} troféus
        </Typography>
        <Box sx={{ mt: 0.75, height: 5, borderRadius: 99, bgcolor: parchment.sunken, overflow: 'hidden', maxWidth: 260 }} aria-hidden>
          <Box sx={{
            height: '100%', bgcolor: gold.main, borderRadius: 99, transformOrigin: 'left center',
            transform: `scaleX(${shown ? lvl.into / lvl.next : 0})`, transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1) 300ms',
          }} />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
        {summary.recent.length === 0 && (
          <Typography sx={{ fontSize: '0.875rem', color: ink.secondary, maxWidth: 300 }}>
            Nenhum troféu ainda. Escreva o background ou role numa sessão para ganhar o primeiro.
          </Typography>
        )}
        {summary.recent.map((r, i) => (
          <Box key={r.id} title={r.title} sx={{
            display: 'flex', alignItems: 'center', gap: 1, maxWidth: { xs: '100%', sm: 200 },
            opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(10px) scale(0.8)',
            transition: `opacity 400ms ease, transform 600ms ${EASE_BACK}`, transitionDelay: `${250 + i * 110}ms`,
          }}>
            <TrophyMedal tier={r.tier} size={36} />
            <Typography noWrap sx={{ fontSize: '0.8125rem', fontWeight: 600, display: { xs: i === 0 ? 'block' : 'none', md: 'block' } }}>{r.title}</Typography>
          </Box>
        ))}
      </Box>
      <ChevronIcon sx={{ color: gold.deep, display: { xs: 'none', sm: 'block' } }} />
    </ButtonBase>
  );
}
