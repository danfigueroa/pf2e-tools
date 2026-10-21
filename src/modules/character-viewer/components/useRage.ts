import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import type { BuildInfo } from '../../../pathbuilder/types'
import {
    NO_RAGE,
    activeRage,
    isRageEmpty,
    rageSpec,
    sanitizeRage,
    titanConditions,
    type RageStored,
} from '../rage'

/**
 * Fúria ligada no personagem, compartilhada com a mesa (campo `rage`). A página
 * monta este hook fora das abas: a Fúria mexe nas condições (o Desajeitado do
 * Titan Mauler), que ficam fora das abas, e no dano da aba de Combate.
 *
 * Aqui só mora o ESTADO. Os PV temporários da entrada e da saída são do
 * `RageBar`, que já tem o PV do personagem — este hook entra antes das
 * condições, e o PV precisa do corte de Drenado que sai delas.
 */
export function useRage(syncKey: string, build: BuildInfo | null) {
    const [stored, setStored] = useSharedState<RageStored>(syncKey, {
        empty: () => NO_RAGE,
        sanitize: sanitizeRage,
        isEmpty: isRageEmpty,
    })

    const spec = useMemo(() => (build ? rageSpec(build) : null), [build])
    const effect = useMemo(() => activeRage(stored, spec), [stored, spec])
    const clumsy = useMemo(() => titanConditions(stored, spec), [stored, spec])

    /** Liga a Fúria. `granted` = PV temporários que ela de fato pôs (0 se não pôs). */
    const start = useCallback((granted: number) => {
        setStored((s) => (s.active ? s : {
            active: true,
            titan: s.titan,
            since: Date.now(),
            ...(granted > 0 ? { granted } : {}),
        }))
    }, [setStored])

    /** Encerra, guardando a hora: a próxima Fúria só dá PV temporários passado 1 minuto. */
    const stop = useCallback(() => {
        setStored((s) => (s.active ? { active: false, titan: s.titan, endedAt: Date.now() } : s))
    }, [setStored])

    /** Empunha (ou guarda) a arma Grande do Titan Mauler. */
    const setTitan = useCallback((on: boolean) => {
        setStored((s) => (s.titan === on ? s : { ...s, titan: on }))
    }, [setStored])

    // Viaja até a aba de Combate, que é `memo`.
    return useMemo(
        () => ({ stored, spec, effect, clumsy, start, stop, setTitan }),
        [stored, spec, effect, clumsy, start, stop, setTitan],
    )
}

export type RageApi = ReturnType<typeof useRage>
