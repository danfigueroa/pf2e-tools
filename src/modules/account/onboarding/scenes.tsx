import type { ComponentType } from 'react';
import { SheetScene } from './scenes/SheetScene';
import { RollScene } from './scenes/RollScene';
import { InitiativeScene } from './scenes/InitiativeScene';
import { MapScene } from './scenes/MapScene';
import { HistoryScene } from './scenes/HistoryScene';
import { JournalScene } from './scenes/JournalScene';
import { tr } from '../../../i18n';

export interface Scene {
  id: string;
  /** Rótulo curto da navegação da vitrine e da barra da janela. */
  label: string;
  title: string;
  text: string;
  /** A cena desenha num fundo escuro (a moldura) em vez do pergaminho. */
  dark?: boolean;
  Scene: ComponentType;
}

// Dados fictícios de propósito: a tela de entrada é pública, e nenhuma cena vai à rede.
export const SCENES: Scene[] = [
  {
    id: 'ficha',
    label: tr('Ficha', 'Sheet'),
    title: tr('Sua ficha do Pathbuilder, viva', 'Your Pathbuilder sheet, alive'),
    text: tr('PV, condições, magias e Pontos Míticos compartilhados com a mesa. O dano que o mestre aplica aparece na sua ficha na hora.', 'HP, conditions, spells and Mythic Points shared with the table. Damage the GM applies shows up on your sheet right away.'),
    Scene: SheetScene,
  },
  {
    id: 'rolagens',
    label: tr('Rolagens', 'Rolls'),
    title: tr('Role e a mesa inteira vê', 'Roll and the whole table sees it'),
    text: tr('Toque num teste e os dados rolam na tela de todo mundo, com a conta completa para conferir.', 'Tap a check and the dice roll on everyone\'s screen, with the full math to check.'),
    dark: true,
    Scene: RollScene,
  },
  {
    id: 'iniciativa',
    label: tr('Iniciativa', 'Initiative'),
    title: tr('O combate em ordem', 'Combat in order'),
    text: tr('Turnos, dano em área, aflições e dano persistente. O mestre conduz, e a ficha de cada um acompanha.', 'Turns, area damage, afflictions and persistent damage. The GM runs it, and everyone\'s sheet follows along.'),
    Scene: InitiativeScene,
  },
  {
    id: 'mapa',
    label: tr('Mapa', 'Map'),
    title: tr('O mapa da mesa, ao vivo', 'The table\'s map, live'),
    text: tr('Tokens com barra de PV, régua, áreas de efeito e pings que todo mundo vê no mesmo instante.', 'Tokens with HP bars, ruler, areas of effect and pings everyone sees at the same moment.'),
    dark: true,
    Scene: MapScene,
  },
  {
    id: 'historico',
    label: tr('Estatísticas', 'Stats'),
    title: tr('As estatísticas de cada sessão', 'Each session\'s stats'),
    text: tr('Média do d20, críticos, maior dano e os troféus da noite. Será que o seu dado é justo?', 'd20 average, crits, biggest damage and the night\'s trophies. Is your die fair?'),
    Scene: HistoryScene,
  },
  {
    id: 'diario',
    label: tr('Diário do GM', 'GM Journal'),
    title: tr('A preparação do mestre', 'The GM\'s prep'),
    text: tr('Sessões, NPCs, ganchos e encontros com XP num lugar só. Um toque mostra o trecho certo à mesa.', 'Sessions, NPCs, hooks and encounters with XP in one place. One tap shows the right passage to the table.'),
    Scene: JournalScene,
  },
];
