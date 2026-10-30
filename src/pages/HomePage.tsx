import { lazy, Suspense, type ReactNode } from 'react';
import { useCombatStatus } from '../services/combatStatus';
import { Box, ButtonBase, Skeleton, Typography } from '@mui/material';
import { ArrowForward as ArrowIcon, Event as EventIcon, Search as SearchIcon, Sync as SyncIcon } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { chrome, displayFont, gold, green, ink, parchment, rule } from '../theme';
import { useMesaInfo, useRole } from '../services/auth';
import { NotificationsButton } from '../components/NotificationsButton';
import { greeting, longDate, sessionSince, sessionTime, untilSession } from '../layouts/format';
import { openSearch } from '../layouts/navigation';

// A Início: a casca (topo, a próxima sessão) vai no bundle principal e pinta na hora; o que é
// VIVO (o grupo, o personagem, os atalhos com o estado da mesa, a última sessão) chega num chunk
// à parte (`home/live`), cada parte com o seu esqueleto.
const live = () => import('./home/live');
const PartyLine = lazy(() => live().then((m) => ({ default: m.PartyLine })));
const PrepareList = lazy(() => live().then((m) => ({ default: m.PrepareList })));
const PlayerCard = lazy(() => live().then((m) => ({ default: m.PlayerCard })));
const GmCombat = lazy(() => live().then((m) => ({ default: m.GmCombat })));
const PlayerCombat = lazy(() => live().then((m) => ({ default: m.PlayerCombat })));
const TrophyShowcase = lazy(() => live().then((m) => ({ default: m.TrophyShowcase })));
const QuickAccess = lazy(() => live().then((m) => ({ default: m.QuickAccess })));
const GroupSection = lazy(() => live().then((m) => ({ default: m.GroupSection })));
const LastSessionSection = lazy(() => live().then((m) => ({ default: m.LastSessionSection })));

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const card = { borderRadius: 3, bgcolor: parchment.paper, border: `1px solid ${rule}` };

const Live = ({ children, height, dark }: { children: ReactNode; height: number; dark?: boolean }) => (
  <Suspense fallback={<Skeleton variant="rounded" height={height} sx={dark ? { bgcolor: chrome.raised } : { borderRadius: 3 }} />}>
    {children}
  </Suspense>
);

/** O quadradinho dourado: "SÁB 14 NOV". Sem sessão marcada, o ícone de calendário. */
const DateBlock = ({ iso, size }: { iso: string | null; size: 'lg' | 'sm' }) => {
  const big = size === 'lg';
  const d = iso ? new Date(iso) : null;
  const part = (opts: Intl.DateTimeFormatOptions) => d!.toLocaleDateString('pt-BR', opts).replace('.', '').toUpperCase();
  const small = { fontSize: big ? '0.75rem' : '0.6875rem', fontWeight: 700, letterSpacing: '0.12em' };
  return (
    <Box sx={{
      width: big ? { xs: 72, sm: 84 } : 68, height: big ? { xs: 80, sm: 92 } : 76, flexShrink: 0, borderRadius: 2, bgcolor: gold.bright, color: green.deepest,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
    }} aria-hidden>
      {d ? (
        <>
          <span style={small}>{part({ weekday: 'short' })}</span>
          <Box component="span" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: big ? '2.375rem' : '2rem', my: 0.5 }}>{d.getDate()}</Box>
          <span style={small}>{part({ month: 'short' })}</span>
        </>
      ) : <EventIcon sx={{ fontSize: big ? 36 : 30 }} />}
    </Box>
  );
};

/** "Sábado, às 14:00" (jogador) ou "Sábado, 14 de novembro, às 14:00" (GM). */
function sessionTitle(iso: string, long: boolean): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const day = long ? `, ${d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}` : '';
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}${day}, às ${sessionTime(iso)}`;
}

/** A sessão de agora: a em andamento, a próxima marcada em /mesa, ou o convite para marcar. */
function useSession() {
  const mesa = useMesaInfo();
  const next = mesa.nextSessionAt && Date.parse(mesa.nextSessionAt) > Date.now() ? mesa.nextSessionAt : null;
  return { mesa, liveAt: mesa.sessionStartedAt, next };
}

const GmHero = () => {
  const { liveAt, next } = useSession();
  const heading = liveAt ? `Começou ${sessionSince(liveAt).replace('desde', 'às')}` : next ? sessionTitle(next, true) : 'Nenhuma sessão marcada';
  return (
    <Box component="section" aria-labelledby="home-proxima" sx={{
      borderRadius: 3, bgcolor: chrome.hero, color: chrome.textSoft, p: { xs: 2.25, sm: 3.5 }, display: 'flex', flexWrap: 'wrap', gap: { xs: 2.5, sm: 3.5 },
    }}>
      <Box sx={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 2.5 } }}>
          {liveAt
            ? (
              <Box sx={{ width: 84, height: 92, flexShrink: 0, borderRadius: 2, bgcolor: chrome.online, color: green.deepest, display: { xs: 'none', sm: 'flex' }, alignItems: 'center', justifyContent: 'center' }} aria-hidden>
                <SyncIcon sx={{ fontSize: 36 }} />
              </Box>
            )
            : <DateBlock iso={next} size="lg" />}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', color: liveAt ? chrome.online : chrome.textSoft }}>
              {liveAt ? 'SESSÃO EM ANDAMENTO' : next ? `PRÓXIMA SESSÃO · ${untilSession(next).toUpperCase()}` : 'PRÓXIMA SESSÃO'}
            </Typography>
            <Typography id="home-proxima" component="h2" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: { xs: '1.375rem', sm: '1.625rem' }, lineHeight: 1.2, color: chrome.text, my: 0.5 }}>
              {heading}
            </Typography>
            <Typography sx={{ color: chrome.textSoft }}>
              <Suspense fallback={<Skeleton width={260} sx={{ bgcolor: chrome.raised }} />}><PartyLine /></Suspense>
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 'auto' }}>
          <ButtonBase component={Link} to="/iniciativa" sx={{ height: 48, px: 2.5, borderRadius: 1.5, bgcolor: gold.bright, color: green.deepest, fontWeight: 700, gap: 1.25, '&:hover': { bgcolor: gold.main } }}>
            Começar combate<ArrowIcon fontSize="small" />
          </ButtonBase>
          <ButtonBase component={Link} to="/mesa" sx={{ height: 48, px: 2.25, borderRadius: 1.5, border: `1px solid ${chrome.lineStrong}`, color: chrome.text, fontWeight: 600 }}>
            {liveAt ? 'Encerrar sessão' : next ? 'Editar data' : 'Marcar sessão'}
          </ButtonBase>
        </Box>
      </Box>
      <Live height={200} dark><PrepareList /></Live>
    </Box>
  );
};

/** A próxima sessão do jogador: o quadro compacto ao lado do personagem. */
const PlayerSession = () => {
  const { liveAt, next } = useSession();
  return (
    <Box component="section" aria-label="Próxima sessão" sx={{
      flex: '2 1 320px', minWidth: 0, borderRadius: 3, bgcolor: chrome.hero, color: chrome.textSoft, p: { xs: 1.75, sm: 3.25 },
      display: 'flex', flexDirection: { xs: 'row', sm: 'column' }, alignItems: { xs: 'center', sm: 'stretch' }, gap: { xs: 1.75, sm: 2.25 },
    }}>
      <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', color: liveAt ? chrome.online : chrome.textSoft }}>
        {liveAt ? 'SESSÃO EM ANDAMENTO' : 'PRÓXIMA SESSÃO'}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.25 }}>
        {liveAt
          ? (
            <Box sx={{ width: 68, height: 76, flexShrink: 0, borderRadius: 2, bgcolor: chrome.online, color: green.deepest, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
              <SyncIcon sx={{ fontSize: 30 }} />
            </Box>
          )
          : <DateBlock iso={next} size="sm" />}
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ display: { xs: 'block', sm: 'none' }, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', color: liveAt ? chrome.online : gold.bright }}>
            {liveAt ? 'SESSÃO EM ANDAMENTO' : 'PRÓXIMA SESSÃO'}
          </Typography>
          <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: { xs: '1rem', sm: '1.375rem' }, lineHeight: 1.25, color: chrome.text }}>
            {liveAt ? `Começou ${sessionSince(liveAt).replace('desde', 'às')}` : next ? sessionTitle(next, false) : 'Nenhuma sessão marcada'}
          </Typography>
          {next && !liveAt && <Typography sx={{ fontSize: '0.9375rem', color: chrome.textSoft }}>{untilSession(next) === 'hoje' ? 'É hoje' : untilSession(next) === 'amanhã' ? 'É amanhã' : `Faltam ${untilSession(next).replace('em ', '')}`}</Typography>}
        </Box>
      </Box>
      <Typography sx={{ display: { xs: 'none', sm: 'block' }, mt: 'auto', pt: 2, borderTop: `1px solid ${chrome.line}`, fontSize: '0.875rem', lineHeight: 1.5 }}>
        {liveAt ? 'A sessão está valendo: suas rolagens entram no histórico da noite.' : 'O GM marca a data em Configurações da mesa; ela aparece aqui para todos.'}
      </Typography>
    </Box>
  );
};

export const HomePage = () => {
  const role = useRole();
  const { mesa } = useSession();
  const first = (role.displayName ?? role.username ?? '').split(' ')[0];
  const hello = role.isGm && first ? `${greeting()}, ${first}` : greeting();
  const combat = useCombatStatus();
  const inCombat = !!combat && combat.round > 0;

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 3.5 } }}>
      {/* Topo (desktop): no celular quem faz isso é o cabeçalho do layout. */}
      <Box component="header" sx={{ display: { xs: 'none', md: 'flex' }, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '0.875rem', color: ink.secondary }}>{longDate()}{role.isGm ? '' : ` · ${mesa.name}`}</Typography>
          <Typography component="h1" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.875rem' }}>{inCombat && role.isGm ? 'Combate em andamento' : hello}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ButtonBase onClick={openSearch} aria-label="Buscar uma página" sx={{
            ...card, borderRadius: 1.75, height: 48, width: 360, maxWidth: '100%', px: 1.75, gap: 1.25, justifyContent: 'flex-start', color: ink.secondary,
          }}>
            <SearchIcon fontSize="small" />
            <Box component="span" sx={{ flex: 1, minWidth: 0, textAlign: 'left', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Ir para uma página…
            </Box>
            <Box component="kbd" sx={{ fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, px: 0.875, py: 0.25, borderRadius: 0.75, border: `1px solid ${rule}` }}>
              {isMac ? '⌘K' : 'Ctrl K'}
            </Box>
          </ButtonBase>
          <NotificationsButton />
        </Box>
      </Box>
      <Typography component="h1" sx={{ display: { xs: 'block', md: 'none' }, fontFamily: displayFont, fontWeight: 600, fontSize: '1.5rem', mt: 0.5 }}>{hello}</Typography>

      {inCombat ? (
        <Live height={300} dark>{role.isGm ? <GmCombat /> : <PlayerCombat />}</Live>
      ) : role.isGm ? (
        <GmHero />
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 2, sm: 2.5 } }}>
          <Live height={260}><PlayerCard /></Live>
          <PlayerSession />
        </Box>
      )}

      <Live height={200}><QuickAccess gm={role.isGm} members={mesa.members} /></Live>

      {role.userId && <Live height={96}><TrophyShowcase /></Live>}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'flex-start' }}>
        <Live height={300}><GroupSection gm={role.isGm} /></Live>
        <Live height={300}><LastSessionSection gm={role.isGm} inCombat={inCombat && role.isGm} /></Live>
      </Box>

      <Box component="footer" sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1.5, pt: 2, borderTop: `1px solid ${rule}`, fontSize: '0.8125rem', color: ink.secondary }}>
        <span>Feito por fãs para a comunidade Pathfinder 2e</span>
        <span>Gratuito e não oficial · Pathfinder é marca registrada da Paizo Inc.</span>
      </Box>
    </Box>
  );
};
