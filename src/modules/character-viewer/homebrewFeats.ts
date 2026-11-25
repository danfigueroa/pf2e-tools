import { parseFeatEntry, type BuildInfo, type HomebrewFeatRef } from '../../pathbuilder/types'

/** A posição distingue talentos homônimos. Fichas anteriores guardavam apenas nome → slot → id. */
export function sheetHomebrewFeats(build: BuildInfo): Map<number, HomebrewFeatRef> {
    const refs = new Map<number, HomebrewFeatRef>()
    const covil = build.covil
    if (!covil) return refs
    const names = (build.feats ?? []).map((feat) => parseFeatEntry(feat).name)
    const seen = new Set<string>()
    const repeated = new Set<string>()
    for (const name of names) {
        if (seen.has(name)) repeated.add(name)
        seen.add(name)
    }
    names.forEach((name, index) => {
        if (covil.homebrewFeats) {
            const ref = covil.homebrewFeats[index]
            if (ref?.name === name && typeof ref.id === 'string' && ref.id.startsWith('mesa:')) refs.set(index, ref)
        } else if (!repeated.has(name)) {
            const slot = covil.slots?.[name]
            if (typeof slot !== 'string') return
            const id = covil.ids?.[slot]
            if (typeof id === 'string' && id.startsWith('mesa:')) refs.set(index, { id, name, slot })
        }
    })
    return refs
}
