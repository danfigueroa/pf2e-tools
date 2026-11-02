/* i18n-ignore-file */
// Modelos prontos de cada parte do diário. O botão "Modelo" do editor insere o
// modelo no cursor (ou no texto vazio): é ponto de partida, o GM apaga o que não usa.
// Os modelos em inglês (`TEMPLATES_EN`) usam `:::players`, que o parse aceita junto de `:::jogadores`.

import type { DocKind } from './doc'
import { isEn } from '../../i18n'

export type TemplateKey = DocKind | 'prep' | 'scene' | 'encounter' | 'recap'

const PLAYERS = ':::jogadores Lido em voz alta\nDescreva o que os personagens veem, ouvem e sentem.\n:::'

const TEMPLATES_PT: Record<TemplateKey, string> = {
    prep: [
        '## Onde paramos',
        '- ',
        '',
        '## Objetivo da sessão',
        'O que precisa acontecer para a sessão valer a pena.',
        '',
        '## Começo forte',
        PLAYERS,
        '',
        '## Segredos e pistas',
        '- [ ] ',
        '- [ ] ',
        '',
        '## Recompensas',
        '- Tesouro:',
        '- XP:',
    ].join('\n'),
    scene: [
        PLAYERS,
        '',
        '**Objetivo:** ',
        '**Quem está aqui:** [[ ]]',
        '**Saídas:** ',
        '',
        '### Se der errado',
        '- ',
    ].join('\n'),
    encounter: [
        '**Terreno:** ',
        '**Táticas:** ',
        '**Moral:** foge com menos da metade dos PV.',
        '**Recompensa:** ',
    ].join('\n'),
    recap: [
        '## O que aconteceu',
        '- ',
        '',
        '## Ganchos para a próxima',
        '- ',
        '',
        '## Recompensas dadas',
        '- ',
    ].join('\n'),
    npc: [
        '**Aparência:** ',
        '**Voz e maneirismos:** ',
        '**O que quer:** ',
        '**O que sabe:** ',
        '',
        '## Segredo',
        'Só o GM sabe.',
        '',
        '## Falas',
        '> "…"',
        '',
        ':::jogadores Primeira impressão',
        'Como os personagens o percebem ao conhecê-lo.',
        ':::',
    ].join('\n'),
    location: [
        PLAYERS,
        '',
        '**Quem está aqui:** [[ ]]',
        '**O que há para achar:** ',
        '**Perigos:** ',
        '',
        '## Segredos do lugar',
        '- ',
    ].join('\n'),
    item: [
        '**Nível / preço:** ',
        '**Traços:** ',
        '**Onde está:** ',
        '',
        ':::jogadores Descrição',
        'O que os personagens percebem ao examiná-lo.',
        ':::',
        '',
        '## Regras',
        '',
        '## História',
    ].join('\n'),
    faction: [
        '**Líder:** [[ ]]',
        '**Objetivo:** ',
        '**Recursos:** ',
        '**Relação com o grupo:** ',
        '',
        '## Membros',
        '- [[ ]]',
        '',
        '## Planos em andamento',
        '- ',
    ].join('\n'),
    other: '',
    thread: [
        '**O que é:** ',
        '**Quem sabe:** [[ ]]',
        '**Como os jogadores descobrem:** ',
        '',
        '## Pistas',
        '- [ ] ',
        '- [ ] ',
        '- [ ] ',
    ].join('\n'),
    session: '',
}

const PLAYERS_EN = ':::players Read aloud\nDescribe what the characters see, hear and feel.\n:::'

const TEMPLATES_EN: Record<TemplateKey, string> = {
    prep: [
        '## Where we left off', '- ', '',
        '## Session goal', 'What needs to happen for the session to be worth it.', '',
        '## Strong start', PLAYERS_EN, '',
        '## Secrets and clues', '- [ ] ', '- [ ] ', '',
        '## Rewards', '- Treasure:', '- XP:',
    ].join('\n'),
    scene: [
        PLAYERS_EN, '',
        '**Goal:** ', '**Who is here:** [[ ]]', '**Exits:** ', '',
        '### If it goes wrong', '- ',
    ].join('\n'),
    encounter: [
        '**Terrain:** ', '**Tactics:** ', '**Morale:** flees below half HP.', '**Reward:** ',
    ].join('\n'),
    recap: [
        '## What happened', '- ', '',
        '## Hooks for next time', '- ', '',
        '## Rewards given', '- ',
    ].join('\n'),
    npc: [
        '**Appearance:** ', '**Voice and mannerisms:** ', '**What they want:** ', '**What they know:** ', '',
        '## Secret', 'Only the GM knows.', '',
        '## Lines', '> "…"', '',
        ':::players First impression', 'How the characters perceive them on meeting.', ':::',
    ].join('\n'),
    location: [
        PLAYERS_EN, '',
        '**Who is here:** [[ ]]', '**What there is to find:** ', '**Dangers:** ', '',
        "## The place's secrets", '- ',
    ].join('\n'),
    item: [
        '**Level / price:** ', '**Traits:** ', '**Where it is:** ', '',
        ':::players Description', 'What the characters notice when examining it.', ':::', '',
        '## Rules', '',
        '## History',
    ].join('\n'),
    faction: [
        '**Leader:** [[ ]]', '**Goal:** ', '**Resources:** ', '**Relationship with the group:** ', '',
        '## Members', '- [[ ]]', '',
        '## Plans in motion', '- ',
    ].join('\n'),
    other: '',
    thread: [
        '**What it is:** ', '**Who knows:** [[ ]]', '**How the players find out:** ', '',
        '## Clues', '- [ ] ', '- [ ] ', '- [ ] ',
    ].join('\n'),
    session: '',
}

/** Os modelos no idioma da conta (os textos são ponto de partida, o GM escreve no que quiser). */
export const TEMPLATES: Record<TemplateKey, string> = isEn ? TEMPLATES_EN : TEMPLATES_PT
