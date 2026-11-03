// Os tipos de página da Wiki da Mesa: rótulo, a infobox de cada um e o modelo de texto.
//
// A infobox é texto curto por campo e aceita `[[ ]]`: um campo que aponta para outra página
// ("Onde está: [[Absalão]]") vira link e conta nos backlinks dela, como o texto. `link: true` só diz
// que o editor oferece as páginas existentes naquele campo.

import type { WikiKind } from '../../services/wiki'
import { tr } from '../../i18n'

export const KIND_LABEL: Record<WikiKind, { one: string; many: string }> = {
    npc: { one: 'NPC', many: 'NPCs' },
    location: { one: tr('Local', 'Place'), many: tr('Locais', 'Places') },
    item: { one: 'Item', many: tr('Itens', 'Items') },
    creature: { one: tr('Criatura', 'Creature'), many: tr('Criaturas', 'Creatures') },
    faction: { one: tr('Facção', 'Faction'), many: tr('Facções', 'Factions') },
    deity: { one: tr('Divindade', 'Deity'), many: tr('Divindades', 'Deities') },
    event: { one: tr('Evento', 'Event'), many: tr('Eventos', 'Events') },
    lore: { one: tr('Lore', 'Lore'), many: tr('Lore', 'Lore') },
    other: { one: tr('Outro', 'Other'), many: tr('Outros', 'Others') },
}

export interface FieldDef {
    key: string
    label: string
    /** O editor oferece as páginas da Wiki (o valor vira `[[Título]]`). */
    link?: boolean
    /** Opções fixas (o valor é uma delas). */
    options?: string[]
    placeholder?: string
}

const NPC_STATUS = [tr('Vivo', 'Alive'), tr('Morto', 'Dead'), tr('Desaparecido', 'Missing'), tr('Desconhecido', 'Unknown')]
const ATTITUDE = [tr('Aliado', 'Ally'), tr('Amistoso', 'Friendly'), tr('Indiferente', 'Indifferent'), tr('Hostil', 'Hostile'), tr('Inimigo', 'Enemy')]

export const INFOBOX: Record<WikiKind, FieldDef[]> = {
    npc: [
        { key: 'ancestry', label: tr('Ancestralidade', 'Ancestry'), placeholder: tr('humano, elfo…', 'human, elf…') },
        { key: 'role', label: tr('Ocupação', 'Occupation'), placeholder: tr('taverneiro, guarda…', 'innkeeper, guard…') },
        { key: 'status', label: tr('Situação', 'Status'), options: NPC_STATUS },
        { key: 'attitude', label: tr('Atitude com o grupo', 'Attitude to the party'), options: ATTITUDE },
        { key: 'location', label: tr('Onde está', 'Where'), link: true },
        { key: 'faction', label: tr('Facção', 'Faction'), link: true },
    ],
    location: [
        { key: 'type', label: tr('Tipo', 'Type'), placeholder: tr('cidade, masmorra, taverna…', 'city, dungeon, tavern…') },
        { key: 'ruler', label: tr('Quem governa', 'Ruled by'), link: true },
        { key: 'population', label: tr('População', 'Population') },
    ],
    item: [
        { key: 'level', label: tr('Nível', 'Level') },
        { key: 'rarity', label: tr('Raridade', 'Rarity'), options: [tr('Comum', 'Common'), tr('Incomum', 'Uncommon'), tr('Raro', 'Rare'), tr('Único', 'Unique')] },
        { key: 'holder', label: tr('Com quem está', 'Held by'), link: true },
        { key: 'location', label: tr('Onde está', 'Where'), link: true },
    ],
    creature: [
        { key: 'habitat', label: tr('Onde vive', 'Habitat'), link: true },
        { key: 'status', label: tr('Situação', 'Status'), options: [tr('Viva', 'Alive'), tr('Derrotada', 'Defeated'), tr('Fugiu', 'Fled'), tr('Desconhecida', 'Unknown')] },
    ],
    faction: [
        { key: 'leader', label: tr('Líder', 'Leader'), link: true },
        { key: 'base', label: tr('Sede', 'Headquarters'), link: true },
        { key: 'attitude', label: tr('Relação com o grupo', 'Relation to the party'), options: ATTITUDE },
    ],
    deity: [
        { key: 'domains', label: tr('Domínios', 'Domains') },
        { key: 'edicts', label: tr('Éditos', 'Edicts') },
        { key: 'anathema', label: tr('Anátemas', 'Anathema') },
    ],
    event: [
        { key: 'when', label: tr('Quando (no mundo)', 'When (in-world)') },
        { key: 'where', label: tr('Onde', 'Where'), link: true },
        { key: 'session', label: tr('Sessão', 'Session') },
    ],
    lore: [],
    other: [],
}

/** O texto de onde a lista mostra a "trilha" (local dentro de local). Só o tipo dá sentido ao "Fica em". */
export const PARENT_LABEL: Record<WikiKind, string> = {
    npc: tr('Faz parte de', 'Part of'),
    location: tr('Fica em', 'Located in'),
    item: tr('Faz parte de', 'Part of'),
    creature: tr('Faz parte de', 'Part of'),
    faction: tr('Faz parte de', 'Part of'),
    deity: tr('Faz parte de', 'Part of'),
    event: tr('Faz parte de', 'Part of'),
    lore: tr('Faz parte de', 'Part of'),
    other: tr('Faz parte de', 'Part of'),
}

const TEMPLATES: Partial<Record<WikiKind, string>> = {
    npc: tr('## Aparência\n\n\n## Personalidade\n\n\n## O que o grupo sabe\n- \n', '## Appearance\n\n\n## Personality\n\n\n## What the party knows\n- \n'),
    location: tr('## Descrição\n\n\n## Quem está aqui\n- \n\n## O que aconteceu aqui\n- \n', '## Description\n\n\n## Who is here\n- \n\n## What happened here\n- \n'),
    item: tr('## Descrição\n\n\n## Poderes conhecidos\n- \n', '## Description\n\n\n## Known powers\n- \n'),
    creature: tr('## O que o grupo descobriu\n- \n\n## Fraquezas suspeitas\n- \n', '## What the party found out\n- \n\n## Suspected weaknesses\n- \n'),
    faction: tr('## Objetivos\n\n\n## Membros conhecidos\n- \n', '## Goals\n\n\n## Known members\n- \n'),
    deity: tr('## Fé e seguidores\n\n', '## Faith and followers\n\n'),
    event: tr('## O que aconteceu\n\n\n## Consequências\n- \n', '## What happened\n\n\n## Consequences\n- \n'),
}

export const templateFor = (kind: WikiKind) => TEMPLATES[kind] ?? ''
