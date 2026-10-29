import { lazy, Suspense, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Box, Button, ButtonBase, Skeleton, Typography } from '@mui/material';
import {
  ArrowForward as ArrowIcon,
  ChevronRight as ChevronIcon,
  FormatListNumbered as InitiativeIcon,
  History as HistoryIcon,
  Lock as LockIcon,
  Map as MapIcon,
  MenuBook as RulesIcon,
  PersonAdd as InviteIcon,
  PhoneIphone as ViewerIcon,
  Search as SearchIcon,
  Sync as SyncIcon,
  Transform as TransformIcon,
  VpnKey as KeyIcon,
  Whatshot as ScalerIcon,
  Event as EventIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { chrome, displayFont, gold, green, ink, parchment, rule } from '../theme';
import { useMesaInfo, useRole } from '../services/auth';
import { listPublished } from '../services/sheets';
import { NotificationsButton } from '../components/NotificationsButton';
import { greeting, longDate, sessionDay, sessionSince, sessionTime, untilSession } from '../layouts/format';
import { openSearch } from '../layouts/navigation';

// A Início: a casca (topo, herói, cartões das ferramentas, bastidores do GM) vai no bundle
// principal e pinta na hora; o que é VIVO (o grupo, as prévias com o estado da mesa, o mapa e
// o histórico) chega num chunk à parte (`home/previews`), cada parte com o seu esqueleto.
const previews = () => import('./home/previews');
const GroupPanel = lazy(() => previews().then((m) => ({ default: m.GroupPanel })));
const GroupStrip = lazy(() => previews().then((m) => ({ default: m.GroupStrip })));
const SheetPreview = lazy(() => previews().then((m) => ({ default: m.SheetPreview })));
const InitiativePreview = lazy(() => previews().then((m) => ({ default: m.InitiativePreview })));
const MapPreview = lazy(() => previews().then((m) => ({ default: m.MapPreview })));
const HistoryPreview = lazy(() => previews().then((m) => ({ default: m.HistoryPreview })));
const MobileTools = lazy(() => previews().then((m) => ({ default: m.MobileTools })));

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const card = { borderRadius: 3, bgcolor: parchment.paper, border: `1px solid ${rule}` };
const eyebrow = { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', color: gold.deep, textTransform: 'uppercase' as const };

/** A ficha da pessoa (para "Abrir minha ficha"): a primeira publicada que é dela. */
function useOwnSheet(userId: string | null): string | null {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void listPublished().then((list) => {
      if (alive) setSlug(list.find((s) => s.ownerId === userId)?.slug ?? null);
    });
    return () => { alive = false; };
  }, [userId]);
  return slug;
}

const Live = ({ children, height, dark }: { children: ReactNode; height?: number | string; dark?: boolean }) => (
  <Suspense fallback={<Skeleton variant="rectangular" height={height ?? '100%'} sx={dark ? { bgcolor: chrome.raised } : undefined} />}>
    {children}
  </Suspense>
);

interface ToolCardProps {
  title: string;
  icon: ReactElement;
  description: string;
  footnote?: string;
  to: string;
  linkText: string;
  /** Fundo da área da prévia. */
  stage: object;
  preview: ReactNode;
  /** Proporção na fileira (3 = larga, 2 = estreita), como no design. */
  grow: 2 | 3;
}

const ToolCard = ({ title, icon, description, footnote, to, linkText, stage, preview, grow }: ToolCardProps) => (
  <Box component="article" sx={{ ...card, flex: grow === 3 ? '3 1 520px' : '2 1 340px', minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
    <Box sx={{ height: 260, ...stage }}>{preview}</Box>
    <Box sx={{ p: { xs: 2.5, sm: 3.5 }, pt: { xs: 2.5, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: gold.deep }}>
        {icon}
        <Typography component="h3" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.375rem', color: ink.primary }}>{title}</Typography>
      </Box>
      <Typography sx={{ lineHeight: 1.55, color: ink.secondary }}>{description}</Typography>
      <Box sx={{ mt: 'auto', pt: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: footnote ? 'space-between' : 'flex-end', gap: 1.5 }}>
        {footnote && <Typography variant="body2" color="text.secondary">{footnote}</Typography>}
        <ButtonBase component={Link} to={to} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, minHeight: 44, color: gold.deep, borderRadius: 1, px: 0.5 }}>
          {linkText}<ArrowIcon fontSize="small" />
        </ButtonBase>
      </Box>
    </Box>
  </Box>
);

/**
 * A sessão em destaque no herói: a em andamento (desde quando) ou a próxima marcada pelo GM em
 * /mesa (dia, hora e quanto falta). Sem nenhuma das duas, o herói mostra o selo de sempre.
 */
const SessionHighlight = ({ live, next }: { live: string | null; next: string | null }) => (
  <Box sx={{
    alignSelf: 'flex-start', maxWidth: '100%', boxSizing: 'border-box', position: 'relative',
    display: 'flex', alignItems: 'center', gap: 1.5, px: 1.75, py: 1.25, borderRadius: 2,
    border: `1px solid ${gold.bright}66`, bgcolor: `${gold.bright}14`,
  }}>
    <Box sx={{
      width: 40, height: 40, borderRadius: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: live ? chrome.online : gold.bright, color: green.deepest,
    }}>
      {live ? <SyncIcon fontSize="small" /> : <EventIcon fontSize="small" />}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', color: live ? chrome.online : gold.bright }}>
        {live ? 'SESSÃO EM ANDAMENTO' : 'PRÓXIMA SESSÃO'}
      </Typography>
      {live ? (
        <Typography sx={{ fontWeight: 600, color: chrome.text }}>Começou {sessionSince(live).replace('desde', 'às')}</Typography>
      ) : next && (
        <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1.25 }}>
          <Typography sx={{ fontWeight: 600, color: chrome.text }}>{sessionDay(next)} · {sessionTime(next)}</Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: chrome.textSoft }}>{untilSession(next)}</Typography>
        </Box>
      )}
    </Box>
  </Box>
);

const ToolRow = ({ to, title, text, badge }: { to: string; title: string; text: string; badge: ReactNode }) => (
  <ButtonBase component={Link} to={to} sx={{
    flex: '1 1 340px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 2.5, p: { xs: 2, sm: 2.75 },
    borderRadius: 2.25, bgcolor: parchment.paper, textAlign: 'left', justifyContent: 'flex-start', color: ink.primary,
  }}>
    <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1, px: 1.75, py: 1.5, borderRadius: 1.75, bgcolor: green.deepest, color: chrome.text, flexShrink: 0, minHeight: 52, boxSizing: 'border-box' }}>
      {badge}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.125rem' }}>{title}</Typography>
      <Typography sx={{ lineHeight: 1.45, color: ink.secondary, fontSize: '0.95rem' }}>{text}</Typography>
    </Box>
    <ChevronIcon sx={{ color: gold.deep, flexShrink: 0 }} />
  </ButtonBase>
);

export const HomePage = () => {
  const role = useRole();
  const mesa = useMesaInfo();
  const own = useOwnSheet(role.userId);
  const firstName = (role.displayName ?? role.username ?? '').split(' ')[0];
  const hello = firstName ? `${greeting()}, ${firstName}` : greeting();

  const next = mesa.nextSessionAt && Date.parse(mesa.nextSessionAt) > Date.now() ? mesa.nextSessionAt : null;
  const facts = [
    { icon: <SyncIcon sx={{ fontSize: 16 }} />, text: 'Sincronizado ao vivo' },
    { icon: <LockIcon sx={{ fontSize: 16 }} />, text: 'Só entra quem o GM convida' },
    { icon: <RulesIcon sx={{ fontSize: 16 }} />, text: 'Regras oficiais traduzidas' },
  ];

  const primary = role.isGm
    ? { to: '/iniciativa', text: 'Começar combate' }
    : { to: own ? `/ficha-virtual?ficha=${encodeURIComponent(own)}` : '/ficha-virtual', text: 'Abrir minha ficha' };
  const secondary = role.isGm
    ? { to: '/membros', text: 'Convidar jogador', icon: <InviteIcon /> }
    : { to: '/mapa', text: 'Ver o mapa', icon: <MapIcon /> };

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', display: 'flex', flexDirection: 'column', gap: { xs: 2.5, md: 4 } }}>
      {/* Topo (desktop): no celular quem faz isso é o cabeçalho do layout. */}
      <Box component="header" sx={{ display: { xs: 'none', md: 'flex' }, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '0.875rem', color: ink.secondary }}>{longDate()}</Typography>
          <Typography component="h1" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '2rem' }}>{hello}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ButtonBase onClick={openSearch} aria-label="Buscar uma página" sx={{
            ...card, borderRadius: 1.75, height: 48, width: 320, maxWidth: '100%', px: 1.75, gap: 1.25,
            justifyContent: 'flex-start', color: ink.secondary,
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

      {/* Herói + o grupo */}
      <Box component="section" sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
        <Box sx={{
          flex: '3 1 520px', minWidth: 0, position: 'relative', overflow: 'hidden', borderRadius: 3, bgcolor: chrome.hero, color: chrome.textSoft,
          p: { xs: 3, sm: 5.5 }, pb: { xs: 3, sm: 4.5 }, display: 'flex', flexDirection: 'column', gap: { xs: 1.75, sm: 2.75 }, minHeight: { md: 380 },
        }}>
          <Box component="svg" viewBox="0 0 120 134" aria-hidden sx={{ position: 'absolute', right: { xs: -70, sm: -60 }, top: -20, width: { xs: 200, sm: 360 }, opacity: 0.14 }}>
            <path d="M60 4l52 30v66l-52 30-52-30V34z" fill="none" stroke={gold.bright} strokeWidth="1.2" />
            <path d="M26 86L60 30l34 56zM8 34l52 52 52-52M60 86v44M8 100l18-14M112 100L94 86M60 4v26" fill="none" stroke={gold.bright} strokeWidth="1" />
          </Box>
          <Typography sx={{ display: { xs: 'block', md: 'none' }, fontSize: '0.875rem' }}>{hello}</Typography>
          {mesa.sessionStartedAt || next ? (
            <SessionHighlight live={mesa.sessionStartedAt} next={next} />
          ) : (
            <Box component="span" sx={{
              display: { xs: 'none', sm: 'flex' }, alignSelf: 'flex-start', alignItems: 'center', gap: 1, fontSize: '0.8125rem', fontWeight: 600,
              letterSpacing: '0.03em', px: 1.5, py: 0.75, borderRadius: 99, border: `1px solid ${chrome.lineStrong}`, color: chrome.text,
            }}>
              <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: chrome.online, boxShadow: `0 0 0 4px ${chrome.online}2E` }} />
              Pathfinder 2e Remaster · em português
            </Box>
          )}
          <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: { xs: '1.625rem', sm: '2.75rem' }, lineHeight: 1.12, color: chrome.text, maxWidth: 560, position: 'relative' }}>
            Tudo o que a mesa usa, num lugar só.
          </Typography>
          <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: '1.125rem', lineHeight: 1.55, maxWidth: 520 }}>
            Fichas, iniciativa, mapa e rolagens sincronizados em tempo real em todos os aparelhos. Cada jogador cuida da própria ficha; o GM conduz o resto.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: { xs: 1.25, sm: 1.5 }, mt: 0.5, position: 'relative' }}>
            <Button component={Link} to={primary.to} variant="contained" endIcon={<ArrowIcon />} sx={{
              height: { xs: 48, sm: 52 }, px: 2.75, borderRadius: 1.75, fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap',
              bgcolor: gold.bright, color: green.deepest, '&:hover': { bgcolor: gold.main },
            }}>
              {primary.text}
            </Button>
            <Button component={Link} to={secondary.to} variant="outlined" startIcon={secondary.icon} sx={{
              height: { xs: 48, sm: 52 }, px: 2.75, borderRadius: 1.75, fontWeight: 600, fontSize: '1rem', whiteSpace: 'nowrap',
              borderColor: chrome.lineStrong, color: chrome.text, '&:hover': { borderColor: gold.bright, bgcolor: 'transparent' },
            }}>
              {secondary.text}
            </Button>
          </Box>
          <Box sx={{ mt: 'auto', pt: { xs: 2, sm: 2.75 }, borderTop: `1px solid ${chrome.line}`, display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: '12px 28px' }, fontSize: '0.875rem' }}>
            {facts.map((f, i) => (
              <Box key={f.text} component="span" sx={{ display: i > 0 ? { xs: 'none', sm: 'flex' } : 'flex', alignItems: 'center', gap: 1, '& svg': { color: gold.bright } }}>
                {f.icon}{f.text}
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ ...card, display: { xs: 'none', sm: 'flex' }, flex: '2 1 340px', minWidth: 0, p: 3.5, flexDirection: 'column', gap: 2.25 }}>
          <Live height={320}><GroupPanel /></Live>
          <Button component={Link} to="/ficha-virtual" variant="outlined" endIcon={<ArrowIcon />} sx={{ mt: 'auto', height: 46, borderRadius: 1.5, borderColor: rule, color: ink.primary, fontWeight: 600 }}>
            Ver todas as fichas
          </Button>
        </Box>
      </Box>

      {/* Celular: o grupo numa fileira e as ferramentas em grade. */}
      <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 2.5 }}>
        <Live height={140}><GroupStrip /></Live>
        <Live height={290}><MobileTools /></Live>
      </Box>

      {/* Ferramentas (tablet e desktop) */}
      <Box component="section" sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', gap: 2.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.5 }}>
          <Box>
            <Typography sx={eyebrow}>Ferramentas da mesa</Typography>
            <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.75rem' }}>Para a noite de jogo</Typography>
          </Box>
          <Typography sx={{ maxWidth: 420, color: ink.secondary }}>Tudo compartilhado: o que um aparelho muda, os outros veem na hora.</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
          <ToolCard
            grow={3}
            title="Ficha Virtual"
            icon={<ViewerIcon />}
            description="Importe o personagem do Pathbuilder e jogue com as regras oficiais traduzidas. Role ataques, perícias e magias com a conta à mostra, e controle PV, condições e ações do turno."
            footnote="Importa do Pathbuilder · celular, tablet e computador"
            to={own ? `/ficha-virtual?ficha=${encodeURIComponent(own)}` : '/ficha-virtual'}
            linkText="Abrir ficha"
            stage={{ bgcolor: chrome.raised, overflow: 'hidden' }}
            preview={<Live dark><SheetPreview /></Live>}
          />
          <ToolCard
            grow={2}
            title="Iniciativa"
            icon={<InitiativeIcon />}
            description="Monte o encontro com o grupo e monstros da AON. O dano já sai com resistências e fraquezas, e venenos e dano persistente se resolvem sozinhos."
            to="/iniciativa"
            linkText="Abrir iniciativa"
            stage={{ bgcolor: parchment.sunken }}
            preview={<Live><InitiativePreview /></Live>}
          />
          <ToolCard
            grow={2}
            title="Mapa de Combate"
            icon={<MapIcon />}
            description="Tokens do encontro com barra de PV, régua com diagonal 5-10-5 e áreas de efeito. Todos veem o mesmo mapa, e o GM leva a mesa de um mapa para outro."
            to="/mapa"
            linkText="Abrir mapa"
            stage={{ bgcolor: parchment.sunken }}
            preview={<Live><MapPreview /></Live>}
          />
          <ToolCard
            grow={3}
            title="Histórico de Rolagens"
            icon={<HistoryIcon />}
            description="Toda rolagem aparece na tela de todos e fica guardada por sessão, com 20 e 1 naturais, média do dado, dano rolado e os troféus da noite."
            footnote="Uma página por sessão · estatísticas por personagem"
            to="/historico"
            linkText="Ver histórico"
            stage={{ bgcolor: chrome.raised }}
            preview={<Live dark><HistoryPreview /></Live>}
          />
        </Box>
        {/* De todos (decisão do usuário): a forma de batalha é do personagem, não do GM. */}
        <Box sx={{ display: 'flex', borderRadius: 3, bgcolor: parchment.sunken, p: 1 }}>
          <ToolRow
            to="/transformation"
            title="Stat Block de Transformação"
            text="Forma Animal, Forma Elemental e as outras do Remaster, com os números do seu personagem e exportação em PNG."
            badge={<><TransformIcon sx={{ color: gold.bright }} /><Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Formas</Typography></>}
          />
        </Box>
      </Box>

      {/* Bastidores do GM */}
      {role.isGm && (
        <Box component="section" sx={{ borderRadius: 3, bgcolor: parchment.sunken, p: { xs: 2, sm: 3.5 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: green.deepest, display: 'flex', alignItems: 'center', justifyContent: 'center', color: gold.bright, flexShrink: 0 }}>
              <KeyIcon fontSize="small" />
            </Box>
            <Box>
              <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 600, fontSize: '1.375rem' }}>Bastidores do GM</Typography>
              <Typography variant="body2" color="text.secondary">Visível só para quem conduz a mesa</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <ToolRow
              to="/escalar-monstro"
              title="Escalar Monstro"
              text="Qualquer criatura da AON no nível que a sua mesa precisa, pelas tabelas do GM Core."
              badge={<><ScalerIcon sx={{ color: gold.bright }} /><Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Nível ±</Typography></>}
            />
          </Box>
        </Box>
      )}

      <Box component="footer" sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1.5, pt: 1, borderTop: `1px solid ${rule}`, fontSize: '0.8125rem', color: ink.secondary }}>
        <span>Feito por fãs para a comunidade Pathfinder 2e</span>
        <span>Gratuito e não oficial · Pathfinder é marca registrada da Paizo Inc.</span>
      </Box>
    </Box>
  );
};
