// A ficha completa do monstro, aberta dentro do cartão do combate.
//
// O mestre já escolheu esta criatura na AON; abrir outra aba no meio do turno
// para reler um Golpe ou uma habilidade é o tipo de ida e volta que o
// gerenciador existe para evitar.
//
// **Nada é reescrito**: a ficha vem de `/api/creature?name=` pelo mesmo cliente
// do escalar monstro (`fetchMonster`, com cache em memória) e é desenhada pelo
// mesmo `MonsterStatBlock` — como o catálogo de condições e o `ConditionsDialog`
// vieram inteiros do character-viewer.
//
// **Busca sob demanda, ao abrir.** A ficha completa é grande e o encontro mora
// no `localStorage`; guardá-la lá seria uma segunda cópia capaz de divergir da
// AON, pela mesma razão que `pcFromBuild` não guarda o `BuildInfo` inteiro. O
// componente só existe enquanto aberto, e reabrir bate no cache — instantâneo.

import { useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { OpenInNew as LinkIcon } from '@mui/icons-material'
import { ink } from '../../../theme'
import { fetchMonster } from '../../../services/monster'
import { scaleMonster } from '../../monster-scaler/scaling'
import { MonsterStatBlock } from '../../monster-scaler/components/MonsterStatBlock'
import type { ScaledMonster } from '../../monster-scaler/types'
import type { NpcCombatant } from '../types'

interface Props {
    npc: NpcCombatant
    /** Nome na AON, já resolvido por `aonNameOf`. */
    aonName: string
    /** Há condição ativa mexendo nos números? Ver o aviso lá embaixo. */
    modified: boolean
}

export function CombatantSheet({ npc, aonName, modified }: Props) {
    const [monster, setMonster] = useState<ScaledMonster | null>(null)
    const [failed, setFailed] = useState(false)

    // `npc.level` é o alvo, não o da AON: para um monstro comum os dois são
    // iguais e `scaleMonster` devolve a ficha original (a propriedade de
    // identidade que o check-scaling verifica); para um que veio do escalar
    // monstro, ele reproduz exatamente os números que estão no cartão.
    const { level, scaleOverrides } = npc

    useEffect(() => {
        let cancelled = false
        setFailed(false)
        void fetchMonster(aonName).then((detail) => {
            if (cancelled) return
            if (!detail) { setFailed(true); return }
            setMonster(scaleMonster(detail, level, scaleOverrides ?? {}))
        })
        return () => { cancelled = true }
    }, [aonName, level, scaleOverrides])

    if (failed) {
        return (
            <Alert
                severity="warning"
                sx={{ mt: 1 }}
                action={npc.aonUrl ? (
                    <Button size="small" href={npc.aonUrl} target="_blank" rel="noopener" startIcon={<LinkIcon />}>
                        Abrir na AON
                    </Button>
                ) : undefined}
            >
                Não foi possível carregar a ficha de {aonName}.
            </Alert>
        )
    }

    if (!monster) {
        return (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1, py: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" sx={{ color: ink.secondary }}>
                    Carregando a ficha de {aonName}…
                </Typography>
            </Stack>
        )
    }

    return (
        <Box sx={{ mt: 1 }}>
            {/* A ficha é a REFERÊNCIA publicada, não o estado vivo: ela traz a
                CA impressa, enquanto o cartão acima mostra a CA já com as
                condições. Enquanto não há condição os dois números são o mesmo
                e o aviso seria ruído — ele só aparece quando divergem de fato.
                Aplicar os modificadores dentro do bloco seria pior: teria de
                valer também para salvaguardas, perícias e ataques, e o
                MonsterStatBlock é o mesmo que o escalar monstro exporta. */}
            {modified && (
                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: ink.secondary }}>
                    Números publicados da AON — os do cartão acima já contam as condições ativas.
                </Typography>
            )}
            <MonsterStatBlock monster={monster} />
        </Box>
    )
}
