/**
 * Magias de AÇÃO VARIÁVEL: o jogador escolhe quantas ações gasta ao conjurar (1 a 3) e,
 * conforme a regra DA MAGIA, mudam o dano, a cura, o número de alvos ou projéteis, a
 * área e os efeitos. A AON descreve isso em prosa e em listas por quantidade de ações —
 * heterogêneo demais para ler com segurança —, então as magias mais usadas ficam num
 * CATÁLOGO escrito à mão, conferido contra o texto da AON (como `psiAmps.ts`). As que
 * não estão aqui ganham só o seletor de ações (e o custo certo no contador), com o aviso
 * de que o efeito muda e deve ser lido na descrição.
 *
 * Tudo em função de (rank conjurado, ações). Nada aqui rola: devolve os números, e o
 * diálogo da magia rola e posta como sempre. Nomes legados e remasterizados dividem a
 * mesma entrada (Magic Missile = Force Barrage, Scorching Ray = Blazing Bolt, Qi Blast = Ki Blast).
 */
import type { ScaledComponent } from './heightening'

export interface ActionRange {
    min: number
    max: number
}

/**
 * "Single Action to Three Actions" → 1..3; "Single Action or Two Actions" → 1..2.
 * Magia de ação fixa (ou o que não se lê) → `null`.
 */
export function actionRange(actions: string | number | undefined | null): ActionRange | null {
    if (actions == null) return null
    const s = String(actions).toLowerCase()
    if (!/\b(to|or)\b|—/.test(s)) return null
    const word = (w: string): number | null => {
        if (/\bsingle\b|\bone\b|^1\b/.test(w)) return 1
        if (/\btwo\b|^2\b/.test(w)) return 2
        if (/\bthree\b|^3\b/.test(w)) return 3
        return null
    }
    const parts = s.split(/\s+(?:to|or)\s+/)
    if (parts.length !== 2) return null
    const lo = word(parts[0])
    const hi = word(parts[1])
    return lo != null && hi != null && lo < hi ? { min: lo, max: hi } : null
}

/** O que a escolha de ações faz com a magia, no rank conjurado. */
export interface Variant {
    /** Substituem o dano/cura da prosa; `null` = a magia não está no catálogo. */
    components: ScaledComponent[] | null
    /** Quantos ataques/projéteis a escolha dá (raios do Blazing Bolt): cada um rola o seu ataque. */
    rays: number
    /** Efeitos que mudam com as ações (alvos, área, condições), em português. */
    notes: string[]
}

/** O id é reatribuído por posição em `variantFor`: a seleção do jogador precisa sobreviver a cada render. */
const component = (kind: 'damage' | 'healing', types: string[], count: number, faces: number, flat = 0): ScaledComponent => ({
    id: 0,
    kind,
    formula: '',
    types,
    persistent: false,
    count,
    faces,
    flat,
    nth: 0,
    occurrences: 1,
    value: { count, faces, flat },
    changed: true,
    uncertain: false,
})

const dmg = (type: string, count: number, faces: number, flat = 0) => component('damage', [type], count, faces, flat)
const heal = (count: number, faces: number, flat = 0) => component('healing', [], count, faces, flat)

/** O que a ficha muda nas regras do catálogo. */
export interface VariantOptions {
    /** Healing Hands (Clérigo 1, Player Core pg. 114): o Heal rola d10 em vez de d8. */
    healingHands?: boolean
    /** Selective Energy (Clérigo 6, Player Core pg. 117): no Heal/Harm em área, até 5 criaturas ficam de fora. */
    selectiveEnergy?: boolean
}

const selective = (n: number, opts: VariantOptions): string[] =>
    n === 3 && opts.selectiveEnergy ? ['Selective Energy: escolha até 5 criaturas na área que NÃO são alvo.'] : []

type Maker = (rank: number, n: number, opts: VariantOptions) => Variant
const variant = (components: ScaledComponent[], notes: string[], rays = 1): Variant => ({ components, notes, rays })

/** Nome canônico → regra. Cada fórmula foi conferida contra o texto da AON. */
const CATALOG: Record<string, { base: number; make: Maker }> = {
    // Heal: 1d8 por rank; com 2 ações, +8 por rank ao curar criatura viva. 1 ação toque, 2 ações 9 m, 3 ações emanação de 9 m.
    // Healing Hands troca os d8 por d10 (o +8 por rank continua).
    heal: {
        base: 1,
        make: (r, n, opts) => {
            const faces = opts.healingHands ? 10 : 8
            return variant(
                [heal(r, faces, n === 2 ? 8 * r : 0)],
                [
                    n === 1 ? 'Alcance de toque.' : n === 2 ? `Alcance de 9 m. +${8 * r} de cura em criatura VIVA (contra morto-vivo o dano é só ${r}d${faces}).` : 'Emanação de 9 m: todos os vivos e mortos-vivos na área.',
                    ...(opts.healingHands ? ['Healing Hands: d10 em vez de d8.'] : []),
                    ...selective(n, opts),
                ],
            )
        },
    },
    // Harm: 1d8 por rank de dano em criatura viva; com 2 ações, +8 por rank só ao CURAR um morto-vivo disposto.
    harm: {
        base: 1,
        make: (r, n, opts) => variant(
            [dmg('void', r, 8)],
            [
                n === 1 ? 'Alcance de toque. Salvaguarda de Fortitude básica.' : n === 2 ? `Alcance de 9 m. Curando morto-vivo disposto: ${r}d8 + ${8 * r}.` : 'Emanação de 9 m: todos os vivos e mortos-vivos na área.',
                ...selective(n, opts),
            ],
        ),
    },
    // Force Barrage / Magic Missile: 1d4+1 de força por projétil; um projétil por ação; Heightened (+2): +1 por ação.
    'force barrage': {
        base: 1,
        make: (r, n) => {
            const shots = n * (1 + Math.floor((r - 1) / 2))
            return variant(
                [dmg('force', shots, 4, shots)],
                [`${shots} projétil${shots === 1 ? '' : 'eis'} (1d4+1 cada, acerto automático). Escolha o alvo de cada um; no mesmo alvo o dano soma.`],
            )
        },
    },
    // Scorching Ray / Blazing Bolt: um raio por ação (cada um com ataque), 2d6 com 1 ação e 4d6 com 2 ou 3;
    // Heightened (+1): +1d6 (1 ação) ou +2d6 (2-3 ações) por raio.
    'blazing bolt': {
        base: 2,
        make: (r, n) => variant(
            [dmg('fire', n === 1 ? r : 2 * r, 6)],
            [`${n} raio${n === 1 ? '' : 's'} (um ataque de magia cada, em alvos diferentes). O MAP só sobe depois de todos.`],
            n,
        ),
    },
    // Ki Blast / Qi Blast: cone 15/30/60 pés e 2d6/3d6/4d6; Heightened (+1): +1d6 (1 ação) ou +2d6 (2-3 ações).
    'ki blast': {
        base: 3,
        make: (r, n) => variant(
            [dmg('force', n === 1 ? r - 1 : n === 2 ? 2 * r - 3 : 2 * r - 2, 6)],
            [`Cone de ${n === 1 ? '4,5' : n === 2 ? '9' : '18'} m. Fortitude: sucesso crítico ignora; sucesso ½; falha cheio e empurra 1,5 m; falha crítica dobro e empurra 3 m.`],
        ),
    },
    // Disorienting Flash: 1d10 (quadrado de 1,5 m), 2d10 (explosão de 3 m), 2d10 (explosão de 6 m); +1d10 por rank em todas.
    'disorienting flash': {
        base: 2,
        make: (r, n) => variant(
            [dmg('sonic', n === 1 ? r - 1 : r, 10)],
            [
                n === 1 ? 'Quadrado de 1,5 m; ofuscado na falha.' : n === 2 ? 'Explosão de 3 m; ofuscado na falha.' : 'Explosão de 6 m; ofuscado E surdo na falha.',
                'Fortitude básica.',
            ],
        ),
    },
    // Concordant Choir: 1d4 (um inimigo), 2d4 (explosão de 3 m), 2d4 (emanação de 9 m); +1d4 (1 ação) ou +2d4 (2-3 ações) por rank.
    'concordant choir': {
        base: 1,
        make: (r, n) => variant(
            [dmg('sonic', n === 1 ? r : 2 * r, 4)],
            [n === 1 ? 'Um inimigo.' : n === 2 ? 'Explosão de 3 m.' : 'Emanação de 9 m.', 'Fortitude básica.'],
        ),
    },
    // Banishing Touch (War of Immortals pg. 154, rank 2): toque, ataque de magia corpo a corpo com proficiência mítica.
    // 1d6 contundente com 1 ação, 2d6 com 2 ou 3; Heightened (4th) +1d6, (6th) +2d6, (8th) +3d6 (rank fixo: vale a maior).
    // Lança o alvo: 1 ação 3 m para cima e 3 m para trás; 2 ações 6 m e 3 m; 3 ações 9 m e 6 m; as distâncias crescem com o rank.
    'banishing touch': {
        base: 2,
        make: (r, n) => {
            const tier = r >= 8 ? 3 : r >= 6 ? 2 : r >= 4 ? 1 : 0
            // Em pés, somados às duas distâncias (para o alto e para trás).
            const far = n === 1 ? [0, 10, 20, 30][tier] : [0, 20, 60, 100][tier]
            const base = n === 1 ? [10, 10] : n === 2 ? [20, 10] : [30, 20]
            const m = (ft: number) => String(Math.round(ft * 0.3 * 10) / 10).replace('.', ',')
            return variant(
                [dmg('bludgeoning', (n === 1 ? 1 : 2) + tier, 6)],
                [`Se acertar: o alvo é lançado ${m(base[0] + far)} m para o alto e ${m(base[1] + far)} m para trás, e sofre o dano de queda normal.`],
            )
        },
    },
    // Rebuke Death: (rank − 1)d6 de cura em cada alvo; um alvo por ação.
    'rebuke death': {
        base: 4,
        make: (r, n) => variant(
            [heal(r - 1, 6)],
            [`${n} alvo${n === 1 ? '' : 's'}: cada um recupera os PV. Voltar de Morrendo por esta cura não aumenta Ferido.`],
        ),
    },
}

const ALIASES: Record<string, string> = {
    'magic missile': 'force barrage',
    'scorching ray': 'blazing bolt',
    'qi blast': 'ki blast',
}

const canonical = (name: string): string => {
    const key = name.trim().toLowerCase()
    return ALIASES[key] ?? key
}

/** A magia está no catálogo? (Se não, o diálogo só oferece o seletor de ações e o custo.) */
export const hasVariantRules = (name: string): boolean => canonical(name) in CATALOG

/** Quantidade de ações entre 1 e 3 que a regra aceita para esta magia (o que a AON diz, ou o catálogo). */
export function variantFor(name: string, rank: number, actions: number, opts: VariantOptions = {}): Variant | null {
    const entry = CATALOG[canonical(name)]
    if (!entry) return null
    const made = entry.make(Math.max(entry.base, rank), actions, opts)
    return made.components ? { ...made, components: made.components.map((c, i) => ({ ...c, id: 9500 + i })) } : made
}
