import { useEffect, useMemo, useState } from 'react';
import { Box, ButtonBase, Skeleton, Typography } from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  FormatListNumbered as InitiativeIcon,
  History as HistoryIcon,
  Transform as TransformIcon,
  LocalFireDepartment as FireIcon,
  Map as MapIcon,
  PhoneIphone as ViewerIcon,
  SentimentVeryDissatisfied as BadIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useRole } from '../../services/auth';
import { useTableRolls } from '../../services/rolls';
import { useCombatStatus, type CombatEntry } from '../../services/combatStatus';
import { useImageUrl } from '../../services/images';
import { useMapData } from '../../services/maps';
import { fetchDiarySummary } from '../../services/diary';
import { mergePeople, type DaySummary } from '../../modules/session-diary/stats';
import { computeAwards, shortDay } from '../../modules/session-diary/awards';
import { TokenBadge } from '../../modules/battle-map/components/TokenBadge';
import { BASE_ACTIONS } from '../../modules/character-viewer/actions';
import { rollHeadline, timeAgo } from '../../layouts/format';
import { initialsOf } from '../../layouts/navigation';
import {
  chrome, displayFont, gold, green, HP_COLOR, ink, MAP_BACKDROP, ONLINE_BADGE, parchment, rule, status, TOKEN_NPC, TOKEN_PC,
} from '../../theme';
import { useParty, type PartyMember } from './party';

// As partes VIVAS da Início, num chunk à parte (o estado da mesa, o mapa, o histórico e os
// helpers da ficha não entram no bundle principal). Cada prévia mostra o grupo real e tem o
// seu estado vazio honesto: sem combate, sem mapa, sem rolagens.

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

const Empty = ({ children, dark }: { children: React.ReactNode; dark?: boolean }) => (
  <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 2 }}>
    <Typography variant="body2" sx={{ color: dark ? chrome.textMuted : ink.secondary, maxWidth: 260 }}>{children}</Typography>
  </Box>
);

const sheetLink = (slug: string) => `/ficha-virtual?ficha=${encodeURIComponent(slug)}`;

// --- O grupo -------------------------------------------------------------------------

/** "O grupo": as fichas da mesa com PV, condições e quem está online. */
export function GroupPanel() {
  const { members, ready } = useParty();
  const online = members.filter((m) => m.online).length;
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', color: gold.deep }}>MESA AO VIVO</Typography>
          <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.375rem' }}>O grupo</Typography>
        </Box>
        {members.length > 0 && (
          <Box component="span" sx={{
            display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.8125rem', fontWeight: 600, px: 1.5, py: 0.75,
            borderRadius: 99, bgcolor: ONLINE_BADGE.bg, color: ONLINE_BADGE.text, whiteSpace: 'nowrap',
          }}>
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ONLINE_BADGE.dot }} />
            {online} de {members.length} online
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {!ready && [0, 1, 2].map((i) => <Skeleton key={i} height={64} />)}
        {ready && members.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            Nenhuma ficha publicada nesta mesa ainda. Cada jogador publica a sua pela Ficha Virtual.
          </Typography>
        )}
        {members.map((m, i) => <MemberRow key={m.slug} member={m} last={i === members.length - 1} />)}
      </Box>
    </>
  );
}

const MemberRow = ({ member: m, last }: { member: PartyMember; last: boolean }) => {
  const low = m.hp ? m.hp.current / m.hp.max <= 0.5 : false;
  const sub = [m.className, `Nível ${m.level}`, ...m.conditions.slice(0, 2)].filter(Boolean).join(' · ');
  return (
    <ButtonBase
      component={Link}
      to={sheetLink(m.slug)}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.75, py: 1.25, textAlign: 'left', justifyContent: 'flex-start',
        borderBottom: last ? 'none' : `1px solid ${parchment.sunken}`, borderRadius: 1, color: 'inherit',
      }}
    >
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <TokenBadge slug={m.slug} name={m.name} size={42} />
        <Dot on={m.online} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{m.name}</Typography>
          {m.hp && (
            <Typography noWrap sx={{ fontSize: '0.8125rem', color: low ? status.error : ink.secondary, fontWeight: low ? 600 : 400, flexShrink: 0 }}>
              {m.hp.current}{m.hp.temp > 0 ? ` +${m.hp.temp}` : ''} / {m.hp.max} PV
            </Typography>
          )}
        </Box>
        {m.hp ? <HpBar current={m.hp.current} max={m.hp.max} /> : <Skeleton height={6} />}
        <Typography noWrap sx={{ fontSize: '0.8125rem', color: ink.secondary }}>{sub}</Typography>
      </Box>
    </ButtonBase>
  );
};

/** O grupo no celular: uma fileira de cartões pequenos (rola de lado com seis). */
export function GroupStrip() {
  const { members, ready } = useParty();
  const online = members.filter((m) => m.online).length;
  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.125rem' }}>O grupo</Typography>
        {members.length > 0 && (
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.8125rem', fontWeight: 600, px: 1.25, py: 0.5, borderRadius: 99, bgcolor: ONLINE_BADGE.bg, color: ONLINE_BADGE.text }}>
            <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ONLINE_BADGE.dot }} />{online} online
          </Box>
        )}
      </Box>
      {ready && members.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Nenhuma ficha publicada ainda.</Typography>
      ) : (
        <Box sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(76px, 1fr)', gap: 1.25, overflowX: 'auto', pb: 0.5, mx: -0.25, px: 0.25,
          // Rola de lado com o dedo; a barra de rolagem só sujava a fileira.
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {(ready ? members : []).map((m) => (
            <ButtonBase key={m.slug} component={Link} to={sheetLink(m.slug)} sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, py: 1.5, px: 0.5,
              borderRadius: 2, bgcolor: parchment.paper, border: `1px solid ${rule}`, color: 'inherit', minWidth: 0,
            }}>
              <Box sx={{ position: 'relative' }}>
                <TokenBadge slug={m.slug} name={m.name} size={40} />
                <Dot on={m.online} />
              </Box>
              <Typography noWrap sx={{ fontSize: '0.8125rem', fontWeight: 600, maxWidth: '100%' }}>{m.name.split(/[\s,]/)[0]}</Typography>
              <Box sx={{ width: 56 }}>{m.hp ? <HpBar current={m.hp.current} max={m.hp.max} height={5} /> : <Skeleton height={5} />}</Box>
            </ButtonBase>
          ))}
          {!ready && [0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={104} />)}
        </Box>
      )}
    </Box>
  );
}

// --- Prévias das ferramentas -----------------------------------------------------------

/** A ficha "da vez": a da pessoa; para o GM (ou quem não tem ficha), a primeira do grupo. */
function useFeatured(): PartyMember | null {
  const { members } = useParty();
  const { userId } = useRole();
  return members.find((m) => userId && m.ownerId === userId) ?? members[0] ?? null;
}

const ActionPips = ({ used }: { used: number }) => (
  <Box sx={{ display: 'flex', gap: 0.75 }} aria-label={`${Math.max(0, BASE_ACTIONS - used)} de ${BASE_ACTIONS} ações`}>
    {Array.from({ length: BASE_ACTIONS }, (_, i) => (
      <Box key={i} sx={{
        width: 12, height: 12, transform: 'rotate(45deg)', boxSizing: 'border-box',
        bgcolor: i < BASE_ACTIONS - used ? gold.bright : 'transparent', border: `2px solid ${gold.bright}`,
      }} />
    ))}
  </Box>
);

/** Ficha Virtual: o cartão da ficha da pessoa e a última rolagem dela no feed. */
export function SheetPreview() {
  const m = useFeatured();
  const { rolls } = useTableRolls();
  if (!m) return <Empty dark>Publique uma ficha pela Ficha Virtual para ela aparecer aqui.</Empty>;
  const last = rolls.find((r) => r.slug === m.slug);
  const total = last ? rollHeadline(last) : null;
  return (
    <Box sx={{ height: '100%', display: 'flex', gap: 2.25, alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 3.5 } }}>
      <Box sx={{ width: 290, maxWidth: '100%', flexShrink: 1, minWidth: 0, borderRadius: 2, bgcolor: parchment.paper, p: 2.25, display: 'flex', flexDirection: 'column', gap: 1.5, boxShadow: '0 18px 40px rgba(0,0,0,.35)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <TokenBadge slug={m.slug} name={m.name} size={40} />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontFamily: displayFont, fontWeight: 700 }}>{m.name}</Typography>
            <Typography noWrap sx={{ fontSize: '0.75rem', color: ink.secondary }}>{m.className} · Nível {m.level}</Typography>
          </Box>
        </Box>
        {m.hp && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.625 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
              <Box component="span" sx={{ color: ink.secondary }}>PONTOS DE VIDA</Box>
              <span>{m.hp.current} / {m.hp.max}</span>
            </Box>
            <HpBar current={m.hp.current} max={m.hp.max} height={8} />
          </Box>
        )}
        {m.conditions.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {m.conditions.slice(0, 3).map((c) => (
              <Box key={c} component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, px: 1.125, py: 0.5, borderRadius: 99, bgcolor: parchment.sunken, color: ink.primary }}>{c}</Box>
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1.25, borderTop: `1px solid ${parchment.sunken}` }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: ink.secondary }}>AÇÕES DO TURNO</Typography>
          <ActionPips used={m.actions?.used ?? 0} />
        </Box>
      </Box>
      {last && total !== null && (
        <Box sx={{
          display: { xs: 'none', sm: 'flex' }, width: 210, flexShrink: 0, flexDirection: 'column', gap: 0.75, borderRadius: 2,
          bgcolor: green.deepest, border: `1px solid ${gold.bright}`, p: 2, color: chrome.textSoft,
          boxShadow: '0 18px 40px rgba(0,0,0,.35)', transform: 'translateY(26px)',
        }}>
          <Typography noWrap sx={{ fontSize: '0.75rem', color: chrome.textMuted }}>{last.title}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25 }}>
            <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '2.75rem', lineHeight: 1, color: chrome.text }}>{total}</Typography>
            {last.check?.d20 === 20 && <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: gold.bright }}>NATURAL 20</Typography>}
          </Box>
          {last.check && (
            <Typography sx={{ fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
              d20 <b style={{ color: chrome.text }}>{last.check.d20}</b> {last.check.mod >= 0 ? '+' : '−'} {Math.abs(last.check.mod)}
            </Typography>
          )}
          <Typography sx={{ fontSize: '0.75rem', color: chrome.textMuted }}>{timeAgo(last.at)} · visto por toda a mesa</Typography>
        </Box>
      )}
    </Box>
  );
}

const CombatRow = ({ entry, active }: { entry: CombatEntry; active: boolean }) => {
  const ratio = entry.hp ? entry.hp.current / entry.hp.max : null;
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.125, borderRadius: 1.5,
      bgcolor: active ? green.deepest : parchment.paper, color: active ? chrome.text : ink.primary,
      boxShadow: active ? `0 0 0 2px ${gold.bright}` : 'none', opacity: entry.defeated ? 0.55 : 1,
    }}>
      <Box sx={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 700, color: chrome.onAccent, bgcolor: entry.kind === 'npc' ? TOKEN_NPC : TOKEN_PC,
      }}>{initialsOf(entry.name)}</Box>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.875rem', textDecoration: entry.defeated ? 'line-through' : 'none' }}>
          {entry.name}
          {active && <Box component="span" sx={{ fontWeight: 400, color: chrome.textMuted }}> · é a vez</Box>}
        </Typography>
        {ratio !== null && !active && (
          <Box sx={{ height: 5, borderRadius: 99, bgcolor: parchment.sunken, overflow: 'hidden', maxWidth: 160 }}>
            <Box sx={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, height: '100%', bgcolor: HP_COLOR }} />
          </Box>
        )}
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums' }}>{entry.initiative}</Typography>
    </Box>
  );
};

/** Iniciativa: a ordem do encontro do mapa onde a mesa está, com a vez de quem. */
export function InitiativePreview() {
  const combat = useCombatStatus();
  if (combat === undefined) return <Box sx={{ p: 3 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={44} />)}</Box>;
  if (!combat) return <Empty>Nenhum combate agora. O encontro que o GM montar na Iniciativa aparece aqui.</Empty>;
  // A vez de quem está no topo, e os próximos em seguida (a ordem é circular).
  const start = Math.max(0, combat.order.findIndex((c) => c.id === combat.activeId));
  const rotated = [...combat.order.slice(start), ...combat.order.slice(0, start)].slice(0, 4);
  return (
    <Box sx={{ height: '100%', p: { xs: 2, sm: 2.75 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5, pb: 0.5, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: ink.secondary }}>
        <span>{combat.round > 0 ? `RODADA ${combat.round}` : 'COMBATE NÃO COMEÇOU'}</span><span>INIC.</span>
      </Box>
      {rotated.map((c) => <CombatRow key={c.id} entry={c} active={combat.round > 0 && c.id === combat.activeId} />)}
    </Box>
  );
}

/** Mapa: o mapa onde a mesa está, com os tokens no lugar. */
export function MapPreview() {
  const combat = useCombatStatus();
  const mapId = combat?.mapId ?? null;
  const { data } = useMapData(mapId);
  const src = useImageUrl(data?.meta.image?.url);
  if (combat === undefined) return <Skeleton variant="rectangular" height="100%" />;
  if (!mapId) return <Empty>A mesa ainda não está em nenhum mapa. O GM leva a mesa a um mapa pelo Mapa de Combate.</Empty>;
  if (!data) return <Skeleton variant="rectangular" height="100%" />;

  // O enquadramento: a imagem, senão o que os tokens ocupam (com folga).
  const cells = Object.entries(data.pos).filter(([id]) => data.tokens[id]);
  const rect = data.meta.imageRect ?? (() => {
    if (cells.length === 0) return { x: 0, y: 0, w: 20, h: 14 };
    const xs = cells.map(([, c]) => c.x), ys = cells.map(([, c]) => c.y);
    const x = Math.min(...xs) - 3, y = Math.min(...ys) - 3;
    return { x, y, w: Math.max(...xs) - x + 4, h: Math.max(...ys) - y + 4 };
  })();
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <Box sx={{ position: 'relative', height: '100%', bgcolor: MAP_BACKDROP, overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ position: 'relative', height: '100%', aspectRatio: `${rect.w} / ${rect.h}`, maxWidth: '100%' }}>
          {src && <Box component="img" src={src} alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />}
          {cells.map(([id, cell]) => {
            const t = data.tokens[id];
            return (
              <Box key={id} title={t.name} sx={{
                position: 'absolute', left: pct(cell.x - rect.x, rect.w), top: pct(cell.y - rect.y, rect.h),
                width: pct(t.size || 1, rect.w), aspectRatio: '1', borderRadius: '50%', boxSizing: 'border-box',
                bgcolor: t.kind === 'npc' ? TOKEN_NPC : TOKEN_PC, border: `2px solid ${parchment.paper}`,
                opacity: t.defeated ? 0.4 : 1, boxShadow: '0 2px 6px rgba(0,0,0,.35)',
              }} />
            );
          })}
        </Box>
      </Box>
      <Box component="span" sx={{
        position: 'absolute', right: 12, top: 12, display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.75rem',
        fontWeight: 600, px: 1.25, py: 0.625, borderRadius: 99, bgcolor: parchment.paper, color: ink.primary, maxWidth: 'calc(100% - 24px)',
      }}>
        <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ONLINE_BADGE.dot, flexShrink: 0 }} />
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.meta.name || 'Mapa da mesa'}</Box>
      </Box>
    </Box>
  );
}

function useLastSession(): { day: string; rows: DaySummary[] } | null | undefined {
  const [state, setState] = useState<{ day: string; rows: DaySummary[] } | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void fetchDiarySummary().then((all) => {
      if (!alive) return;
      if (!all || all.length === 0) return setState(null);
      const day = all.reduce((max, r) => (r.day > max ? r.day : max), all[0].day);
      setState({ day, rows: all.filter((r) => r.day === day) });
    });
    return () => { alive = false; };
  }, []);
  return state;
}

/** Histórico: o d20 da última sessão (barra por face) e os destaques dela. */
export function HistoryPreview() {
  const session = useLastSession();
  const view = useMemo(() => {
    if (!session) return null;
    const hist = Array.from({ length: 20 }, (_, i) => session.rows.reduce((n, r) => n + (r.hist[i] ?? 0), 0));
    const checks = session.rows.reduce((n, r) => n + r.checks, 0);
    const sum = session.rows.reduce((n, r) => n + r.d20Sum, 0);
    const awards = computeAwards(mergePeople(session.rows), 'session')
      .filter((a) => a.winner && ['blessed', 'cursed', 'engine', 'hot', 'cold'].includes(a.id))
      .slice(0, 3);
    return { hist, top: Math.max(1, ...hist), avg: checks ? sum / checks : null, awards };
  }, [session]);

  if (session === undefined) return <Skeleton variant="rectangular" height="100%" sx={{ bgcolor: chrome.raised }} />;
  if (!session || !view) return <Empty dark>Nenhuma rolagem guardada ainda. A primeira sessão aparece aqui.</Empty>;
  return (
    <Box sx={{ height: '100%', display: 'flex', gap: 3, p: { xs: 2, sm: 3 }, color: chrome.textSoft }}>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: chrome.textMuted }}>
          <span>D20 · {shortDay(session.day).toUpperCase()}</span>
          {view.avg !== null && <span>MÉDIA {view.avg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span>}
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '4px' }} role="img" aria-label="Quantas vezes cada face do d20 saiu na última sessão">
          {view.hist.map((n, i) => (
            <Box key={i} sx={{
              flex: 1, height: `${Math.max(4, (n / view.top) * 100)}%`, borderRadius: '3px 3px 0 0',
              bgcolor: i === 19 ? gold.bright : i === 0 ? HP_COLOR : chrome.lineStrong,
            }} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: chrome.textMuted }}><span>1</span><span>10</span><span>20</span></Box>
      </Box>
      <Box sx={{ width: 200, flexShrink: 0, display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', gap: 1.25 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: chrome.textMuted }}>DESTAQUES DA NOITE</Typography>
        {view.awards.length === 0 && <Typography sx={{ fontSize: '0.8125rem', color: chrome.textMuted }}>Poucas rolagens para eleger alguém.</Typography>}
        {view.awards.map((a) => (
          <Box key={a.id} sx={{ display: 'flex', gap: 1.25, alignItems: 'center', px: 1.5, py: 1.25, borderRadius: 1.5, bgcolor: chrome.active }}>
            {a.tone === 'bad' ? <BadIcon sx={{ color: HP_COLOR, fontSize: 22 }} /> : a.id === 'engine' ? <FireIcon sx={{ color: gold.bright, fontSize: 22 }} /> : <TrophyIcon sx={{ color: gold.bright, fontSize: 22 }} />}
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: '0.875rem', fontWeight: 600, color: chrome.text }}>{a.title}</Typography>
              <Typography noWrap sx={{ fontSize: '0.75rem', color: chrome.textMuted }}>{a.winner!.person.name} · {a.winner!.label}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// --- Celular: as ferramentas em grade 2×2 ---------------------------------------------

const tile = {
  display: 'flex', flexDirection: 'column', gap: 1.25, p: 2, borderRadius: 2.25, minHeight: 132,
  textAlign: 'left', alignItems: 'stretch', justifyContent: 'flex-start', color: 'inherit',
};

/** As quatro ferramentas no celular, cada uma com uma linha viva. */
export function MobileTools() {
  const m = useFeatured();
  const combat = useCombatStatus();
  const { rolls } = useTableRolls();
  const current = combat?.order.find((c) => c.id === combat.activeId);
  const mini = rolls.filter((r) => r.check).slice(0, 7).reverse();
  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.125rem' }}>Ferramentas</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.25 }}>
        <ButtonBase component={Link} to={m ? sheetLink(m.slug) : '/ficha-virtual'} sx={{ ...tile, bgcolor: chrome.raised, color: chrome.textSoft }}>
          <ViewerIcon sx={{ color: gold.bright, fontSize: 22 }} />
          <Typography sx={{ fontFamily: displayFont, fontWeight: 600, color: chrome.text }}>Ficha Virtual</Typography>
          <Typography noWrap sx={{ mt: 'auto', fontSize: '0.8125rem', color: chrome.textSoft }}>
            {m ? `${m.name.split(/[\s,]/)[0]}${m.hp ? ` · ${m.hp.current}/${m.hp.max} PV` : ''}` : 'Publique a sua ficha'}
          </Typography>
        </ButtonBase>
        <ButtonBase component={Link} to="/iniciativa" sx={{ ...tile, bgcolor: parchment.paper, border: `1px solid ${rule}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <InitiativeIcon sx={{ color: gold.deep, fontSize: 22 }} />
            {combat && combat.round > 0 && (
              <Box component="span" sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.04em', px: 0.875, py: 0.375, borderRadius: 99, bgcolor: gold.bright, color: green.deepest }}>AO VIVO</Box>
            )}
          </Box>
          <Typography sx={{ fontFamily: displayFont, fontWeight: 600 }}>Iniciativa</Typography>
          <Typography noWrap sx={{ mt: 'auto', fontSize: '0.8125rem', color: ink.secondary }}>
            {combat && combat.round > 0 ? `Rodada ${combat.round}${current ? ` · vez de ${current.name.split(/[\s,]/)[0]}` : ''}` : 'Nenhum combate agora'}
          </Typography>
        </ButtonBase>
        <ButtonBase component={Link} to={combat?.mapId ? `/mapa/${combat.mapId}` : '/mapa'} sx={{
          ...tile, bgcolor: parchment.sunken,
          backgroundImage: `linear-gradient(transparent calc(100% - 1px), ${green.deepest}24 0), linear-gradient(90deg, transparent calc(100% - 1px), ${green.deepest}24 0)`,
          backgroundSize: '22px 22px',
        }}>
          <MapIcon sx={{ color: gold.deep, fontSize: 22 }} />
          <Typography sx={{ fontFamily: displayFont, fontWeight: 600 }}>Mapa de Combate</Typography>
          <Typography noWrap sx={{ mt: 'auto', fontSize: '0.8125rem', color: ink.secondary }}>
            {combat?.mapId ? 'A mesa está num mapa' : 'Só no computador'}
          </Typography>
        </ButtonBase>
        <ButtonBase component={Link} to="/historico" sx={{ ...tile, bgcolor: parchment.paper, border: `1px solid ${rule}` }}>
          <HistoryIcon sx={{ color: gold.deep, fontSize: 22 }} />
          <Typography sx={{ fontFamily: displayFont, fontWeight: 600 }}>Rolagens</Typography>
          <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'flex-end', gap: '3px', height: 22 }} aria-hidden>
            {mini.length === 0
              ? <Typography sx={{ fontSize: '0.8125rem', color: ink.secondary }}>Histórico da mesa</Typography>
              : mini.map((r) => (
                <Box key={r.id} sx={{
                  flex: 1, height: `${Math.max(15, (r.check!.d20 / 20) * 100)}%`, borderRadius: '2px',
                  bgcolor: r.check!.d20 === 20 ? gold.bright : r.check!.d20 === 1 ? HP_COLOR : parchment.sunken,
                }} />
              ))}
          </Box>
        </ButtonBase>
        <ButtonBase component={Link} to="/transformation" sx={{
          ...tile, gridColumn: '1 / -1', minHeight: 0, flexDirection: 'row', alignItems: 'center', gap: 1.5,
          bgcolor: parchment.paper, border: `1px solid ${rule}`,
        }}>
          <TransformIcon sx={{ color: gold.deep, fontSize: 22 }} />
          <Typography sx={{ fontFamily: displayFont, fontWeight: 600, flex: 1 }}>Transformações</Typography>
          <Typography noWrap sx={{ fontSize: '0.8125rem', color: ink.secondary }}>Formas de batalha</Typography>
        </ButtonBase>
      </Box>
    </Box>
  );
}
