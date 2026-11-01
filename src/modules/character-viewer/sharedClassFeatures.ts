// GERADO por scripts/fetch-shared-class-features.mjs — não edite à mão (rode o script e confira o diff).
//
// Características de classe que a AON tem com o MESMO nome em mais de uma classe. Para elas a ficha busca a
// descrição com a classe do personagem ("Weapon Expertise (Magus)"): o texto muda (armas simples do Druida ×
// marciais do Magus, a tradição do Bardo), e o cache de descrições é global por nome. O servidor reconhece o
// parêntese como classe (`classHint` em `api/_lib/feat-core.js`) e escolhe a entrada daquela classe.
import type { BuildInfo } from '../../pathbuilder/types'

export const SHARED_CLASS_FEATURES: ReadonlySet<string> = new Set([
    "Ability Boosts",
    "Alertness",
    "Ancestry And Background",
    "Ancestry Feats",
    "Ancestry and Background",
    "Arcane Spellcasting",
    "Armor Expertise",
    "Armor Mastery",
    "Attribute Boosts",
    "Battle Hardened",
    "Defensive Robes",
    "Deity",
    "Deny Advantage",
    "Divine Spellcasting",
    "Evasion",
    "Expert Spellcaster",
    "Fortitude Expertise",
    "General Feats",
    "Great Fortitude",
    "Greater Resolve",
    "Greater Weapon Specialization",
    "Improved Evasion",
    "Incredible Senses",
    "Initial Proficiencies",
    "Iron Will",
    "Juggernaut",
    "Legendary Spellcaster",
    "Light Armor Expertise",
    "Light Armor Mastery",
    "Lightning Reflexes",
    "Magical Fortitude",
    "Master Spellcaster",
    "Medium Armor Expertise",
    "Medium Armor Mastery",
    "Perception Expertise",
    "Perception Legend",
    "Perception Mastery",
    "Reflex Expertise",
    "Resolve",
    "Shield Block",
    "Signature Spells",
    "Simple Weapon Expertise",
    "Skill Feats",
    "Skill Increases",
    "Spell Repertoire",
    "Vigilant Senses",
    "Weapon Expertise",
    "Weapon Mastery",
    "Weapon Specialization",
    "Will Expertise",
])

/** O nome com que a habilidade é BUSCADA (e guardada no cache): com a classe, se o nome é de várias classes. */
export function specialLookupName(build: Pick<BuildInfo, 'class'>, name: string): string {
    const cls = String(build.class ?? '').trim()
    return cls && SHARED_CLASS_FEATURES.has(name) ? `${name} (${cls})` : name
}
