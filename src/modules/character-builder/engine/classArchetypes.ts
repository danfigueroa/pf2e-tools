// Arquétipos de classe: a escolha de nível 1 muda a classe e exige sua dedicação no talento de classe do 2º nível.
// Cada vínculo usa o id da entrada da AON, inclusive quando o instinto tem o mesmo nome do arquétipo.
import type { Choice } from '../types'
import type { RuleEntry } from '../rules/types'

export const CLASS_ARCHETYPE = 'class-archetype'
export const BLOODRAGER = 'archetype:archetype-283'
export const WAR_MAGE = 'archetype:archetype-331'

interface ClassArchetype {
    className: string
    dedication: string
    subclass: string
}

export const CLASS_ARCHETYPES: Record<string, ClassArchetype> = {
    // War of Immortals pg. 60 (Archetypes.aspx?ID=283).
    [BLOODRAGER]: { className: 'Barbarian', dedication: 'feat:feat-7239', subclass: 'instinct:instinct-14' },
    // Battlecry! pg. 68 (Archetypes.aspx?ID=331).
    [WAR_MAGE]: { className: 'Wizard', dedication: 'feat:feat-7976', subclass: 'arcane-school:arcane-school-22' },
}

export function selectedClassArchetype(choice: Choice | undefined, cls: RuleEntry | undefined) {
    if (!choice || !('id' in choice) || !cls || CLASS_ARCHETYPES[choice.id]?.className !== cls.name) return undefined
    return choice.id
}

/** Altera só o retrato compilado da classe. Remover o arquétipo recupera as escolhas do rascunho. */
export function adjustedClass(cls: RuleEntry | undefined, archetype: string | undefined): RuleEntry | undefined {
    if (!cls?.class) return cls
    const c = cls.class
    if (archetype === BLOODRAGER) {
        return { ...cls, class: { ...c, trainedSkills: { fixed: ['athletics', 'medicine'], additional: 2 } } }
    }
    if (archetype !== WAR_MAGE) return cls
    const replaced = ['Arcane Bond', 'Arcane Thesis', 'Defensive Robes']
    const features = (c.features ?? []).filter((f) => !replaced.includes(f.name))
    return { ...cls, class: { ...c, defenses: { ...c.defenses, light: 1, medium: 1 },
        attacks: { ...c.attacks, martial: c.attacks?.simple },
        features: [{ level: 1, name: 'War Magic' }, ...features] } }
}
