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
} from '@mui/icons-material';

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
  { text: 'Início', icon: <HomeIcon />, path: '/', section: 'jogo', keywords: ['inicio', 'home', 'painel', 'grupo'] },
  {
    text: 'Ficha Virtual', icon: <ViewerIcon />, path: '/ficha-virtual', section: 'jogo',
    keywords: ['ficha', 'personagem', 'pathbuilder', 'magias', 'talentos', 'inventario', 'pv', 'publicar'],
  },
  {
    text: 'Iniciativa', icon: <InitiativeIcon />, path: '/iniciativa', section: 'jogo',
    keywords: ['combate', 'encontro', 'turno', 'rodada', 'dano', 'monstros', 'condicoes'],
  },
  {
    text: 'Mapa de Combate', icon: <MapIcon />, path: '/mapa', section: 'jogo',
    keywords: ['mapa', 'grid', 'tokens', 'regua', 'area', 'vtt', 'dados'],
  },
  {
    text: 'Rolagens', icon: <HistoryIcon />, path: '/historico', section: 'jogo',
    keywords: ['historico', 'rolagens', 'sessao', 'estatisticas', 'trofeus', 'd20', 'diario'],
  },
  {
    // De todos: é o stat block da forma de batalha do PERSONAGEM (decisão do usuário).
    text: 'Transformações', icon: <TransformIcon />, path: '/transformation', section: 'jogo',
    keywords: ['transformacao', 'forma', 'battle form', 'stat block', 'druida'],
  },
  {
    text: 'Escalar Monstro', icon: <ScalerIcon />, path: '/escalar-monstro', section: 'gm',
    keywords: ['monstro', 'criatura', 'nivel', 'gm core', 'aon', 'stat block'],
  },
  {
    // Tem os segredos da campanha: o jogador não vê, e o servidor recusa.
    text: 'Diário de Campanha', icon: <JournalIcon />, path: '/diario-campanha', section: 'gm', gmOnly: true,
    keywords: ['diario', 'campanha', 'preparacao', 'sessao', 'npc', 'notas', 'cenas', 'ganchos', 'handout'],
  },
  {
    text: 'Membros e convites', icon: <MembersIcon />, path: '/membros', section: 'mesa',
    keywords: ['membros', 'convite', 'jogadores', 'senha', 'dono', 'ficha'],
  },
  {
    text: 'Configurações da mesa', icon: <SettingsIcon />, path: '/mesa', section: 'mesa',
    keywords: ['configuracoes', 'mesa', 'nome', 'sessao', 'proxima sessao'],
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
  gm: 'Bastidores do GM',
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
