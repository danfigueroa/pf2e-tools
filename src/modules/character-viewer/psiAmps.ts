/**
 * Amps dos psi cantrips do Psíquico (Dark Archive): gastando 1 Ponto de Foco ao
 * conjurar, o truque ganha o efeito de amp — que às vezes troca o dano inteiro.
 *
 * O Pathbuilder só marca o nome ("Frostbite (Amped)"); os números do amp, que
 * têm a PRÓPRIA entrada de heightening, vêm da AON e são transcritos aqui, como
 * `unarmed.ts` e `magicWeapons.ts`, e casam pelo NOME do truque. Cobre os psi
 * cantrips da Oscillating Wave (Thalos) e os da The Tangible Dream que o Loki tem
 * (Imaginary Weapon e Shield); outro conscious mind é acrescentar uma entrada.
 *
 * Quem amplifica: o Psíquico, e quem tem o arquétipo com o Psi Development — no
 * Dark Archive (Remastered) a dedicação dá o truque SEM o amp, e é o Psi
 * Development que o concede (`canAmpPsiCantrips`).
 *
 * Rank base de todos é 1, e cada rank acima soma o "Amp Heightened (+1)".
 * Texto em pt-BR; nomes de magia e tipos de dano canônicos em inglês.
 */
import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'
import type { ScaledComponent } from './heightening'

/** Uma parcela de dano que o amp põe no lugar do dano normal. */
export interface AmpDamage {
    count: number
    faces: number
    flat: number
    /** Tipo canônico em inglês. */
    type: string
    persistent: boolean
}

export interface PsiAmp {
    /** Nome canônico da magia. */
    name: string
    /** O que o amp faz, numa linha. */
    summary: string
    /** Troca o dano normal por estes, no rank conjurado. Ausente = o amp não mexe no dano. */
    damage?: (rank: number, melee: boolean) => AmpDamage[]
    /** Efeitos com número que não rolam (respingo, PV temporários, fraqueza). */
    notes: (rank: number, melee: boolean) => string[]
    /** O amp muda com o ataque corpo a corpo (Ignition). */
    meleeOption?: boolean
}

const d = (count: number, faces: number, type: string, persistent = false, flat = 0): AmpDamage =>
    ({ count, faces, flat, type, persistent })

const AMPS: PsiAmp[] = [
    {
        name: 'Frostbite',
        summary: 'Drena a energia térmica à distância: 3d4 de frio e PV temporários.',
        damage: (rank) => [d(3 + 2 * (rank - 1), 4, 'cold')],
        notes: (rank) => [
            'Ganha PV temporários iguais à metade do dano que o alvo sofre (depois de resistências); somem em 1 minuto.',
            `Falha crítica: fraqueza ${rank} a contundente até o início do seu próximo turno.`,
        ],
    },
    {
        name: 'Ignition',
        summary: 'Calor puro: 1d10 de fogo (d12 corpo a corpo) mais respingo, sem ferir você.',
        meleeOption: true,
        damage: (rank, melee) => [
            d(rank, melee ? 12 : 10, 'fire'),
            d(rank, 4, 'fire', true),
        ],
        notes: (rank) => [
            `Respingo de fogo: ${rank} (você não sofre o respingo).`,
            'O dano persistente de 1d4 por rank só existe no sucesso crítico, que também dobra o dano inicial.',
        ],
    },
    {
        name: 'Redistribute Potential',
        summary: 'Duas explosões de 3 m adjacentes: 6d6 (frio numa, fogo na outra).',
        damage: (rank) => [d(6 + 2 * (rank - 1), 6, 'cold'), d(6 + 2 * (rank - 1), 6, 'fire')],
        notes: () => [
            'Um lado rouba calor (frio), o outro o concentra (fogo): ligue só o tipo da área do alvo. Criatura nas duas escolhe uma.',
            'Falha: desajeitado 1 (área do frio) ou enfraquecido 1 (área do fogo), por 1 minuto.',
        ],
    },
    {
        name: 'Imaginary Weapon',
        summary: 'Várias armas de força: dois alvos, um ataque em cada, 2d6 de força por rank.',
        damage: (rank) => [d(2 * rank, 6, 'force')],
        notes: () => [
            'Fora do Spellstrike, ataca DOIS alvos diferentes; a penalidade de ataques múltiplos só sobe depois dos dois.',
            'No Spellstrike a magia pega só o alvo do Golpe — com o dano amplificado.',
        ],
    },
    {
        name: 'Shield',
        summary: 'Três camadas de escudo, sustentadas por até 1 minuto.',
        notes: (rank) => {
            const hardness = 5 + 5 * Math.floor((rank - 1) / 2)
            return [
                'Cada Shield Block quebra uma camada e tira o bônus na CA, mas a magia continua; erga de novo ao Sustentar. Quebrada a última, nada de Shield por 10 minutos.',
                `Quebrar duas camadas num bloqueio: Dureza ${Math.floor(hardness * 1.5)}; as três: Dureza ${hardness * 2} (a normal é ${hardness}).`,
                'Mental Balm (se você tiver o talento) pode ser usado no lugar: +2 de status em Vontade contra emoção por 1 minuto e uma tentativa de contra-atacar o amedrontado.',
            ]
        },
    },
    {
        name: 'Entropic Wheel',
        summary: 'A roda ganha 2 motes em vez de 1, a cada vez que ganha um.',
        notes: () => ['Cada mote soma 1 de dano do tipo oposto em magias de frio e fogo (só o dano inicial).'],
    },
    {
        name: 'Thermal Stasis',
        summary: 'A duração passa a 1 minuto.',
        notes: (rank) => [`Resistência ${2 * rank} a fogo e a frio no seu rank (2 por rank).`],
    },
]

// "Frostbite (Amped)" e "Shield (Archetype)" são o mesmo truque do catálogo.
const norm = (name: string) => name.replace(/\s*\((amped|amplificad[oa]|archetype)\)\s*/gi, '').trim().toLowerCase()

/** O nome da magia sem a marca "(Amped)" do Pathbuilder. */
export const baseSpellName = (name: string): string => name.replace(/\s*\((amped|amplificad[oa])\)\s*/gi, '').trim()

export function psiAmpFor(name: string): PsiAmp | null {
    const key = norm(name)
    return AMPS.find((a) => a.name.toLowerCase() === key) ?? null
}

/** Pode amplificar psi cantrips: o Psíquico, ou o arquétipo com o Psi Development. */
export function canAmpPsiCantrips(build: BuildInfo): boolean {
    if (build.class === 'Psychic') return true
    return (build.feats ?? []).some((f) => parseFeatEntry(f).name.trim().toLowerCase() === 'psi development')
}

/** Os psi cantrips do arquétipo são "occult psychic spells" (Psychic Dedication). */
export const hasPsychicArchetype = (build: BuildInfo): boolean =>
    (build.feats ?? []).some((f) => parseFeatEntry(f).name.trim().toLowerCase() === 'psychic dedication')

/** O dano do amp como componentes de magia, no formato que os diálogos rolam. */
export function ampComponents(list: AmpDamage[]): ScaledComponent[] {
    return list.map((a, i): ScaledComponent => ({
        id: 9000 + i, kind: 'damage', formula: '', types: [a.type], persistent: a.persistent,
        count: a.count, faces: a.faces, flat: a.flat, nth: 0, occurrences: 1,
        value: { count: a.count, faces: a.faces, flat: a.flat }, changed: true, uncertain: false,
    }))
}
