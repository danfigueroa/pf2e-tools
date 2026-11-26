import { useCallback, useEffect, useState } from 'react'
import { isEn } from '../../../i18n'
import { peekTraitRule, prefetchTraitRules } from '../../../services/rules'
import { traitLabel } from '../weaponTraits'

/**
 * Os traços em português para os chips ("Attack" → "Ataque"): o nome que o servidor traduziu e guardou no banco
 * (`?traitRules=`, o mesmo dos traços de arma), pedido uma vez para a lista toda. Em inglês, como a AON escreve.
 */
export function useTraitLabels(traits: readonly string[]): (trait: string) => string {
    const key = isEn ? '' : [...new Set(traits.map((t) => t.trim()).filter(Boolean))].sort().join('|')
    const [loaded, setLoaded] = useState(0)
    useEffect(() => {
        if (!key) return
        let alive = true
        void prefetchTraitRules(key.split('|')).then(() => { if (alive) setLoaded((n) => n + 1) })
        return () => { alive = false }
    }, [key])
    return useCallback((trait: string) => (isEn ? trait : traitLabel(trait, peekTraitRule(trait)?.label ?? null)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [loaded])
}
