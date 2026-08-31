// Os três pontos de entrada do cartão: condição, aflição e dano persistente.
//
// Antes, condição era um ⚡ sem rótulo e os outros dois só existiam dentro do
// menu `⋮` — para envenenar um alvo era preciso adivinhar que a opção estava
// ali. Agora são botões ESCRITOS, pela mesma razão já documentada para "Dano" e
// "Cura" em `CombatantVitals`: numa mesa, o mestre tem que achar a ação de
// relance, sem caçar ícone nem abrir menu.
//
// Cada botão também é o RESUMO da sua fatia: leva a contagem do que está ativo,
// então o cartão diz "duas condições, um veneno" sem o olho descer para as
// listas. E quando alguma delas espera uma resposta do mestre — a salvaguarda
// de estágio venceu, o teste plano do dano persistente está pendente — o botão
// vira âmbar sólido no meio dos outros dois vazados. É o sinal que faltava:
// hoje um veneno vencido só aparece para quem rola até a caixa dele.

import { Box, Button, Stack, Tooltip } from '@mui/material'
import {
    Bolt as ConditionIcon,
    Coronavirus as AfflictionIcon,
    LocalFireDepartment as PersistentIcon,
} from '@mui/icons-material'
import { CONDITION_COLOR, gold, status } from '../../../theme'
import type { CombatantView } from '../types'

interface Props {
    view: CombatantView
    onOpenConditions: () => void
    onOpenAfflictions: () => void
    onOpenPersistent: () => void
}

interface ActionProps {
    icon: React.ReactNode
    label: string
    /** Quantos itens ativos; 0 não mostra número, para o botão vazio não pesar. */
    count: number
    /** Espera uma resposta do mestre agora (salvaguarda ou teste plano). */
    attention?: boolean
    /** Acento da fatia — o mesmo das caixas que o botão abre. */
    color: string
    title: string
    ariaLabel: string
    onClick: () => void
}

const ActionButton = ({ icon, label, count, attention, color, title, ariaLabel, onClick }: ActionProps) => (
    <Tooltip title={title}>
        <Button
            size="small"
            variant={attention ? 'contained' : 'outlined'}
            startIcon={icon}
            onClick={onClick}
            aria-label={ariaLabel}
            sx={{
                // Largura pelo conteúdo, como os chips de condição logo abaixo.
                // Com `flex-grow` o botão que quebra para a segunda linha virava
                // uma barra larga sozinha, pesando mais que os dois de cima. E
                // nada de `minWidth` fixo dentro de flex-wrap: a 320px ele
                // estouraria o cartão em vez de dobrar a linha.
                flex: '0 0 auto',
                px: 1,
                fontSize: '0.75rem',
                ...(attention
                    ? { backgroundColor: status.warning, '&:hover': { backgroundColor: '#8E5F14' } }
                    : { color, borderColor: color + '66', '&:hover': { borderColor: color } }),
            }}
        >
            {label}
            {count > 0 && (
                <Box
                    component="span"
                    sx={{
                        ml: 0.75,
                        px: 0.6,
                        borderRadius: 4,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        backgroundColor: attention ? '#00000026' : color + '22',
                    }}
                >
                    {count}
                </Box>
            )}
        </Button>
    </Tooltip>
)

export const CombatantActions = ({
    view,
    onOpenConditions,
    onOpenAfflictions,
    onOpenPersistent,
}: Props) => {
    const { name } = view.combatant

    // A contagem de condições vem de `mods.active`, e não do estado cru: é o
    // que o cartão desenha logo abaixo, já com as impostas e as do estágio de
    // aflição. Duas contas diferentes para a mesma lista seriam um bug esperando.
    const conditionCount = view.mods.active.length

    // `roundsLeft === 0` é a salvaguarda de estágio vencida — mesma leitura de
    // `CombatantAfflictions`, que desenha os quatro graus nesse estado.
    const saveDue = view.afflictions.some((a) => a.roundsLeft === 0)
    const checkDue = view.persistent.some((p) => p.checkDue)

    return (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
            <ActionButton
                icon={<ConditionIcon sx={{ fontSize: '1rem' }} />}
                label="Condições"
                count={conditionCount}
                color={CONDITION_COLOR}
                title="Marcar ou tirar condições"
                ariaLabel={`Condições de ${name}`}
                onClick={onOpenConditions}
            />
            <ActionButton
                icon={<AfflictionIcon sx={{ fontSize: '1rem' }} />}
                label="Aflições"
                count={view.afflictions.length}
                attention={saveDue}
                color={gold.deep}
                title={saveDue
                    ? 'Salvaguarda de estágio vencida — informe o grau na caixa abaixo'
                    : 'Aplicar um veneno ou doença da AON'}
                ariaLabel={`Aflições de ${name}${saveDue ? ', salvaguarda pendente' : ''}`}
                onClick={onOpenAfflictions}
            />
            <ActionButton
                icon={<PersistentIcon sx={{ fontSize: '1rem' }} />}
                label="Persistente"
                count={view.persistent.length}
                attention={checkDue}
                color={status.error}
                title={checkDue
                    ? 'Teste plano pendente — informe o resultado na caixa abaixo'
                    : 'Aplicar dano persistente (fogo, sangramento…)'}
                ariaLabel={`Dano persistente de ${name}${checkDue ? ', teste plano pendente' : ''}`}
                onClick={onOpenPersistent}
            />
        </Stack>
    )
}
