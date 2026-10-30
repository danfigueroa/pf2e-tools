import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, ButtonBase, Chip, LinearProgress, Skeleton, Tab, Tabs, Typography } from '@mui/material';
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
import { TrophyMedal } from './TrophyMedal';

// Troféus do Covil (`/trofeus`, `/trofeus/:user`): o perfil de troféus da conta — o meu ou o de
// um colega da mesa — e o ranking da mesa. O catálogo vem do servidor junto com o perfil.

const CATEGORIES: Record<string, string> = {
  ficha: 'Ficha', historia: 'História e notas', presenca: 'Presença', dados: 'Dados', destaques: 'Destaques da sessão',
  mesa: 'A mesa', mestre: 'Mestre', platina: 'Platina',
};
const TIER_ORDER: TrophyTier[] = ['platina', 'ouro', 'prata', 'bronze'];
const mesaName = (id: string | null) => MESAS.find((m) => m.id === id)?.nome ?? null;
const date = (at: number) => new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const card = { borderRadius: 3, bgcolor: parchment.paper, border: `1px solid ${rule}` };

function TrophyCard({ def, at, mesa, progress, mine }: { def: TrophyDef; at: number | null; mesa: string | null; progress: number; mine: boolean }) {
  const unlocked = at !== null;
  const secret = def.hidden && !unlocked;
  const tier = TROPHY_TIERS[def.tier];
  return (
    <Box component="article" sx={{
      ...card, borderRadius: 2.5, p: 2, display: 'flex', gap: 1.75, alignItems: 'flex-start',
      bgcolor: unlocked ? tier.tint : parchment.paper, borderColor: unlocked ? tier.medal : rule,
    }}>
      <TrophyMedal tier={def.tier} locked={!unlocked} size={52} />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
          <Typography component="h3" sx={{ fontWeight: 700, color: unlocked ? ink.primary : ink.secondary, lineHeight: 1.25 }}>
            {secret ? 'Troféu secreto' : def.title}
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', color: tier.ink, flexShrink: 0, textTransform: 'uppercase' }}>
            {tier.label}
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
            <LinearProgress variant="determinate" value={(progress / def.goal) * 100} sx={{ flex: 1, height: 6, borderRadius: 99, bgcolor: parchment.sunken, '& .MuiLinearProgress-bar': { bgcolor: gold.main } }} />
            <Typography sx={{ fontSize: '0.75rem', color: ink.secondary, fontVariantNumeric: 'tabular-nums' }}>{progress}/{def.goal}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function ProfileHeader({ name, profile, role }: { name: string; profile: TrophyProfile; role: TrophyRole }) {
  const got = new Set(profile.unlocked.map((u) => u.id));
  const ofRole = profile.catalog.filter((d) => d.role === role);
  const total = profile.points.player + profile.points.gm;
  const lvl = levelOf(total);
  const done = ofRole.filter((d) => got.has(d.id)).length;
  return (
    <Box component="section" sx={{ borderRadius: 3, bgcolor: green.deepest, color: chrome.text, p: { xs: 2.25, sm: 3 }, display: 'flex', flexWrap: 'wrap', gap: { xs: 2, sm: 3 }, alignItems: 'center' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 300px', minWidth: 0 }}>
        <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: gold.bright, color: green.deepest, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em' }}>NÍVEL</Typography>
          <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.625rem' }}>{lvl.level}</Typography>
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h1" noWrap sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: { xs: '1.375rem', sm: '1.75rem' } }}>{name}</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: chrome.textSoft }}>{total} pontos · faltam {lvl.next - lvl.into} para o nível {lvl.level + 1}</Typography>
          <LinearProgress variant="determinate" value={(lvl.into / lvl.next) * 100} sx={{ mt: 1, height: 6, borderRadius: 99, bgcolor: chrome.active, '& .MuiLinearProgress-bar': { bgcolor: gold.bright } }} />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2.5 }, flexWrap: 'wrap' }}>
        {TIER_ORDER.map((tier) => (
          <Box key={tier} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <TrophyMedal tier={tier} size={28} />
            <Box>
              <Typography sx={{ fontFamily: displayFont, fontWeight: 700, lineHeight: 1 }}>
                {profile.unlocked.filter((u) => profile.catalog.find((d) => d.id === u.id)?.tier === tier).length}
              </Typography>
              <Typography sx={{ fontSize: '0.6875rem', color: chrome.textSoft }}>{TROPHY_TIERS[tier].label}</Typography>
            </Box>
          </Box>
        ))}
        <Box sx={{ pl: { sm: 1 } }}>
          <Typography sx={{ fontFamily: displayFont, fontWeight: 700, lineHeight: 1 }}>{ofRole.length ? Math.round((done / ofRole.length) * 100) : 0}%</Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: chrome.textSoft }}>{done} de {ofRole.length}</Typography>
        </Box>
      </Box>
    </Box>
  );
}

function Collection({ profile, mine, isGm }: { profile: TrophyProfile; mine: boolean; isGm: boolean }) {
  const hasGm = isGm || profile.points.gm > 0;
  const [role, setRole] = useState<TrophyRole>('player');
  const [category, setCategory] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const unlocked = useMemo(() => new Map(profile.unlocked.map((u) => [u.id, u])), [profile]);
  const list = profile.catalog
    .filter((d) => d.role === role && (!category || d.category === category) && (!missing || !unlocked.has(d.id)))
    .sort((a, b) => Number(unlocked.has(b.id)) - Number(unlocked.has(a.id)) || TIER_POINTS[b.tier] - TIER_POINTS[a.tier]);
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
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 1.5 }}>
        {list.map((d) => {
          const u = unlocked.get(d.id);
          return <TrophyCard key={d.id} def={d} at={u?.at ?? null} mesa={u?.mesa ?? null} progress={profile.progress[d.id] ?? 0} mine={mine} />;
        })}
      </Box>
    </Box>
  );
}

function Ranking({ entries, me }: { entries: RankingEntry[]; me: string | null }) {
  const navigate = useNavigate();
  const groups: { role: TrophyRole; title: string; list: RankingEntry[] }[] = [
    { role: 'player', title: 'Jogadores', list: [...entries].filter((e) => e.points.player > 0 || e.role === 'player').sort((a, b) => b.points.player - a.points.player) },
    { role: 'gm', title: 'Mestres', list: [...entries].filter((e) => e.role === 'gm' || e.points.gm > 0).sort((a, b) => b.points.gm - a.points.gm) },
  ];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {groups.filter((g) => g.list.length > 0).map((g) => (
        <Box key={g.role} component="section" sx={{ ...card, p: { xs: 1.5, sm: 2.5 } }}>
          <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.25rem', px: 1, pb: 1 }}>{g.title}</Typography>
          {g.list.map((e, i) => (
            <ButtonBase key={e.userId} onClick={() => navigate(e.userId === me ? '/trofeus' : `/trofeus/${e.userId}`)} sx={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 1.25, minHeight: 56, borderTop: `1px solid ${parchment.sunken}`,
              justifyContent: 'flex-start', textAlign: 'left', borderRadius: 1, bgcolor: e.userId === me ? `${gold.bright}1F` : 'transparent',
            }}>
              <Typography sx={{ width: 24, fontFamily: displayFont, fontWeight: 700, color: i < 3 ? gold.deep : ink.secondary, textAlign: 'center' }}>{i + 1}</Typography>
              <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: green.mid, color: chrome.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>
                {initialsOf(e.name)}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 600 }}>{e.name}{e.userId === me ? ' (você)' : ''}</Typography>
                <Typography noWrap sx={{ fontSize: '0.8125rem', color: ink.secondary }}>
                  {e.count} {e.count === 1 ? 'troféu' : 'troféus'}{e.platinum ? ` · ${e.platinum} platina` : ''}{e.last ? ` · último: ${e.last.title}` : ''}
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{e.points[g.role]}</Typography>
              <ChevronIcon sx={{ color: gold.deep }} />
            </ButtonBase>
          ))}
        </Box>
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
            <Collection profile={profile} mine={mine} isGm={mine ? role.isGm : entry?.role === 'gm'} />
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
