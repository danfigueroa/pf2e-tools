/**
 * Armas mágicas cujos números **mudam conforme a situação**.
 *
 * O JSON do Pathbuilder exporta um único conjunto de números por arma — o do
 * caso padrão. Uma Gloom Blade no escuro ataca e dana mais, e isso não aparece
 * em lugar nenhum da ficha. A tabela abaixo é escrita à mão a partir das regras
 * (mesma ideia de `unarmed.ts` e `combatGuides.ts`) e casa **pelo nome** da arma.
 *
 * Nomes de item ficam canônicos em inglês (é como a ficha e a AON os chamam);
 * as descrições são pt-BR.
 */

/** Um perfil situacional: o que muda quando a condição vale. */
export interface WeaponProfile {
    /** A condição, em pt-BR — vira o rótulo da linha. */
    when: string
    /** Somado ao ataque da ficha (runa de potência maior neste perfil). */
    attackDelta?: number
    /** Runa striking deste perfil; substitui a da ficha no cálculo dos dados. */
    striking?: string
    /** Dano extra que só existe neste perfil. */
    extraDamage?: string[]
}

export interface MagicWeaponRules {
    /** Página da regra, para quem quiser conferir. */
    source: string
    summary: string
    /** Como chamar o perfil que a ficha já mostra (o padrão do item). */
    baseLabel: string
    profiles: WeaponProfile[]
    /** O que é regra mas não vira número numa linha da tabela. */
    notes?: string[]
}

const MAGIC_WEAPONS: Record<string, MagicWeaponRules> = {
    'gloom blade': {
        source: 'GM Core pg. 242',
        summary:
            'Negra como carvão, a lâmina fica mais potente no escuro. Na luz plena é um '
            + '+1 shortsword; na penumbra ou na escuridão vira um +2 striking shortsword.',
        baseLabel: 'Luz plena (o que a ficha mostra)',
        profiles: [
            {
                when: 'Penumbra ou escuridão',
                attackDelta: 1,
                striking: 'striking',
            },
            {
                when: 'Penumbra ou escuridão, atacando quem não te detecta',
                attackDelta: 1,
                striking: 'striking',
                // Em inglês como o resto do dano extra que vem da ficha: as
                // duas parcelas aparecem lado a lado na mesma linha.
                extraDamage: ['1d6 precision'],
            },
        ],
        notes: [
            'O 1d6 de precisão vale sempre que você ataca uma criatura que não te detecta '
            + '(undetected) — inclusive na luz plena.',
            'Na luz plena a lâmina só emite aura mágica para magias de 4º grau ou mais.',
            'Runas fundamentais melhores que +2 striking também passam a valer na penumbra '
            + 'e na escuridão.',
        ],
    },
}

/** Regras situacionais da arma, ou `null` para arma sem nada de especial. */
export function magicWeaponRules(name: string): MagicWeaponRules | null {
    return MAGIC_WEAPONS[(name || '').trim().toLowerCase()] ?? null
}
