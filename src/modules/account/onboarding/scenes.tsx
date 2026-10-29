import type { ComponentType } from 'react';
import { SheetScene } from './scenes/SheetScene';
import { RollScene } from './scenes/RollScene';
import { InitiativeScene } from './scenes/InitiativeScene';
import { MapScene } from './scenes/MapScene';
import { HistoryScene } from './scenes/HistoryScene';
import { JournalScene } from './scenes/JournalScene';

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
    label: 'Ficha',
    title: 'Sua ficha do Pathbuilder, viva',
    text: 'PV, condições, magias e Pontos Míticos compartilhados com a mesa. O dano que o mestre aplica aparece na sua ficha na hora.',
    Scene: SheetScene,
  },
  {
    id: 'rolagens',
    label: 'Rolagens',
    title: 'Role e a mesa inteira vê',
    text: 'Toque num teste e os dados rolam na tela de todo mundo, com a conta completa para conferir.',
    dark: true,
    Scene: RollScene,
  },
  {
    id: 'iniciativa',
    label: 'Iniciativa',
    title: 'O combate em ordem',
    text: 'Turnos, dano em área, aflições e dano persistente. O mestre conduz, e a ficha de cada um acompanha.',
    Scene: InitiativeScene,
  },
  {
    id: 'mapa',
    label: 'Mapa',
    title: 'O mapa da mesa, ao vivo',
    text: 'Tokens com barra de PV, régua, áreas de efeito e pings que todo mundo vê no mesmo instante.',
    dark: true,
    Scene: MapScene,
  },
  {
    id: 'historico',
    label: 'Histórico',
    title: 'As estatísticas de cada sessão',
    text: 'Média do d20, críticos, maior dano e os troféus da noite. Será que o seu dado é justo?',
    Scene: HistoryScene,
  },
  {
    id: 'diario',
    label: 'Diário do GM',
    title: 'A preparação do mestre',
    text: 'Sessões, NPCs, ganchos e encontros com XP num lugar só. Um toque mostra o trecho certo à mesa.',
    Scene: JournalScene,
  },
];
