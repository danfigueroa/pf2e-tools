// Arquétipos de classe: a escolha de nível 1 muda a classe e exige sua dedicação no talento de classe do 2º nível.
// Cada vínculo usa o id da entrada da AON, inclusive quando o instinto tem o mesmo nome do arquétipo.
import type { Choice } from '../types'
import type { RuleEntry } from '../rules/types'

export const CLASS_ARCHETYPE = 'class-archetype'
export const BLOODRAGER = 'archetype:archetype-283'
export const WAR_MAGE = 'archetype:archetype-331'
export const PALATINE_DETECTIVE = 'archetype:archetype-306'
export const RUNELORD = 'archetype:archetype-303'
/** Advanced School Spell (Player Core pg. 203): o Runelord ganha de bônus no 8º nível. */
export const ADVANCED_SCHOOL_SPELL = 'feat:feat-5036'
/** Quick Identification (Player Core pg. 248): a metodologia Esoterica concede. */
export const QUICK_IDENTIFICATION = 'feat:feat-5195'

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
    // Divine Mysteries pg. 288 (Archetypes.aspx?ID=306): a metodologia Esoterica no lugar das outras.
    [PALATINE_DETECTIVE]: { className: 'Investigator', dedication: 'feat:feat-7557', subclass: 'methodology:methodology-9' },
    // Rival Academies pg. 114 (Archetypes.aspx?ID=303): a School of Thassilonian Rune Magic como escola arcana.
    [RUNELORD]: { className: 'Wizard', dedication: 'feat:feat-7482', subclass: 'arcane-school:arcane-school-25' },
}

/** O arquétipo cuja subclasse é esta (a subclasse só vale com ele). */
export const archetypeOfSubclass = (id: string | undefined) =>
    id ? Object.entries(CLASS_ARCHETYPES).find(([, a]) => a.subclass === id)?.[0] : undefined

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
    if (archetype === RUNELORD) {
        // Rival Academies pg. 114: "Instead of an arcane thesis, you gain a personal rune."
        const features = (c.features ?? []).map((f) => (f.name === 'Arcane Thesis' ? { ...f, name: 'Personal Rune' } : f))
        return { ...cls, class: { ...c, features } }
    }
    if (archetype !== WAR_MAGE) return cls
    const replaced = ['Arcane Bond', 'Arcane Thesis', 'Defensive Robes']
    const features = (c.features ?? []).filter((f) => !replaced.includes(f.name))
    return { ...cls, class: { ...c, defenses: { ...c.defenses, light: 1, medium: 1 },
        attacks: { ...c.attacks, martial: c.attacks?.simple },
        features: [{ level: 1, name: 'War Magic' }, ...features] } }
}
