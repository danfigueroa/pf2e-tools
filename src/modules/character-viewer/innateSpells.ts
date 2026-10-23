/**
 * Magias inatas de talento que NÃO seguem o rank automático do truque.
 *
 * **Arcane Sense** (Player Core pg. 252): "You can cast 1st-rank detect magic at will as an arcane
 * innate spell. If you're a master in Arcana, the spell is heightened to 3rd rank; if you're
 * legendary, it is heightened to 4th rank." O Pathbuilder a exporta como um conjurador
 * ("Caster Arcane Sense") com *Detect Magic* entre os truques, e o app elevava o truque ao rank
 * automático (metade do nível, 4º no nível 7). Pelo texto, o rank é 1 — só sobe com Arcanismo
 * mestre ou lendário.
 */
import { parseFeatEntry, type BuildInfo, type SpellCaster } from '../../pathbuilder/types'

/** Mestre = 6 e lendário = 8 no Pathbuilder (2 × o rank). */
const MASTER = 6
const LEGENDARY = 8

const isArcaneSenseCaster = (build: BuildInfo, caster: SpellCaster): boolean =>
    /arcane sense/i.test(caster.name ?? '')
    && (build.feats ?? []).some((f) => parseFeatEntry(f).name.trim().toLowerCase() === 'arcane sense')

/** O rank fixo das magias do conjurador (Arcane Sense), ou `null` quando vale a regra normal do truque. */
export function fixedInnateRank(build: BuildInfo, caster: SpellCaster): number | null {
    if (!isArcaneSenseCaster(build, caster)) return null
    const arcana = build.proficiencies?.arcana ?? 0
    return arcana >= LEGENDARY ? 4 : arcana >= MASTER ? 3 : 1
}
