import type { ReactElement } from 'react';
import {
  Home as HomeIcon,
  PhoneIphone as ViewerIcon,
  FormatListNumbered as InitiativeIcon,
  Transform as TransformIcon,
  Whatshot as ScalerIcon,
  Map as MapIcon,
  History as HistoryIcon,
  Groups as MembersIcon,
  Tune as SettingsIcon,
  MenuBook as JournalIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import { tr } from '../i18n';

// A navegação do app inteiro numa lista só: a sidebar (em seções), a barra de abas do
// celular e a busca (⌘K) leem daqui — um destino novo entra nos três de uma vez.

/** Largura da sidebar aberta e recolhida (trilho só de ícones). */
export const SIDEBAR_WIDTH = 280;
export const SIDEBAR_RAIL = 76;

/** Celular: altura do cabeçalho e da barra de abas (esta sem a área segura do iPhone). */
export const MOBILE_HEADER_HEIGHT = 64;
export const TAB_BAR_HEIGHT = 64;

/** Abre a busca (⌘K) de qualquer lugar: o campo do topo da Início, a lupa do celular. */
export const openSearch = () => window.dispatchEvent(new Event('pf2e:open-search'));

/** JOGO é de todos; BASTIDORES DO GM e MESA, só do GM (o servidor também confere). */
export type NavSection = 'jogo' | 'gm' | 'mesa';

export interface NavItem {
  text: string;
  icon: ReactElement;
  path: string;
  section: NavSection;
  /** Outras palavras pelas quais a busca acha o destino (sem acento, minúsculas). */
  keywords: string[];
  /** Só o GM vê (o servidor também confere). Sem isso, um item de BASTIDORES vai para JOGO no jogador. */
  gmOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { text: tr('Início', 'Home'), icon: <HomeIcon />, path: '/', section: 'jogo', keywords: ['inicio', 'home', 'painel', tr('grupo', 'group')] },
  {
    text: tr('Ficha Virtual', 'Virtual Sheet'), icon: <ViewerIcon />, path: '/ficha-virtual', section: 'jogo',
    keywords: [tr('ficha', 'sheet'), tr('personagem', 'character'), 'pathbuilder', tr('magias', 'spells'), tr('talentos', 'feats'), 'inventario', 'pv', tr('publicar', 'publish')],
  },
  {
    text: tr('Iniciativa', 'Initiative'), icon: <InitiativeIcon />, path: '/iniciativa', section: 'jogo',
    keywords: [tr('combate', 'combat'), tr('encontro', 'encounter'), tr('turno', 'turn'), tr('rodada', 'round'), tr('dano', 'damage'), tr('monstros', 'monsters'), 'condicoes'],
  },
  {
    text: tr('Mapa de Combate', 'Battle Map'), icon: <MapIcon />, path: '/mapa', section: 'jogo',
    keywords: [tr('mapa', 'map'), 'grid', 'tokens', 'regua', 'area', 'vtt', 'dados'],
  },
  {
    text: tr('Rolagens', 'Rolls'), icon: <HistoryIcon />, path: '/historico', section: 'jogo',
    keywords: ['historico', tr('rolagens', 'rolls'), tr('sessao', 'session'), 'estatisticas', 'trofeus', 'd20', 'diario'],
  },
  {
    // De todos: é o stat block da forma de batalha do PERSONAGEM (decisão do usuário).
    text: tr('Transformações', 'Transformations'), icon: <TransformIcon />, path: '/transformation', section: 'jogo',
    keywords: ['transformacao', tr('forma', 'form'), 'battle form', 'stat block', 'druida'],
  },
  {
    text: tr('Troféus', 'Trophies'), icon: <TrophyIcon />, path: '/trofeus', section: 'jogo',
    keywords: ['trofeus', 'conquistas', 'perfil', 'ranking', tr('pontos', 'points'), 'platina', 'achievements'],
  },
  {
    text: tr('Escalar Monstro', 'Scale Monster'), icon: <ScalerIcon />, path: '/escalar-monstro', section: 'gm',
    keywords: [tr('monstro', 'monster'), tr('criatura', 'creature'), tr('nivel', 'level'), 'gm core', 'aon', 'stat block'],
  },
  {
    // Tem os segredos da campanha: o jogador não vê, e o servidor recusa.
    text: tr('Diário de Campanha', 'Campaign Journal'), icon: <JournalIcon />, path: '/diario-campanha', section: 'gm', gmOnly: true,
    keywords: ['diario', 'campanha', 'preparacao', tr('sessao', 'session'), 'npc', tr('notas', 'notes'), tr('cenas', 'scenes'), tr('ganchos', 'hooks'), 'handout'],
  },
  {
    text: tr('Membros e convites', 'Members and invites'), icon: <MembersIcon />, path: '/membros', section: 'mesa',
    keywords: [tr('membros', 'members'), tr('convite', 'invite'), tr('jogadores', 'players'), tr('senha', 'password'), 'dono', tr('ficha', 'sheet')],
  },
  {
    text: tr('Configurações da mesa', 'Table settings'), icon: <SettingsIcon />, path: '/mesa', section: 'mesa',
    keywords: ['configuracoes', 'mesa', tr('nome', 'name'), tr('sessao', 'session'), tr('proxima sessao', 'next session')],
  },
];

/**
 * O que a pessoa vê, por seção. Jogador não tem as seções do GM, mas o Escalar Monstro continua
 * aberto a ele: vai para JOGO, como a rota, que nunca foi fechada. O que é `gmOnly` some.
 */
export function visibleNav(isGm: boolean): NavItem[] {
  if (isGm) return NAV_ITEMS;
  return NAV_ITEMS.filter((i) => i.section !== 'mesa' && !i.gmOnly).map((i) => (i.section === 'gm' ? { ...i, section: 'jogo' } : i));
}

export const SECTION_LABEL: Record<NavSection, string> = {
  jogo: 'Jogo',
  gm: tr('Bastidores do GM', 'GM Backstage'),
  mesa: 'Mesa',
};

/** `/mapa/abc123` ainda é o item "Mapa de Combate". */
export const isCurrent = (pathname: string, path: string) =>
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);

/** As iniciais de um nome, para avatar sem imagem ("Dan Figueroa" → "DF"). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/[\s,-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
