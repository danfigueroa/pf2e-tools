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
    ExpandMore as ExpandIcon,
    LocalFireDepartment as PersistentIcon,
    MenuBook as SheetIcon,
    Shield as ShieldIcon,
} from '@mui/icons-material'
import { CONDITION_COLOR, gold, green, SHIELD_COLOR, status, greenInk, lightCore, onFrame, WARNING_HOVER } from '../../../theme'
import { lift, useArmed, useReducedMotion } from '../../../motion/motion'
import type { CombatantView } from '../types'
import { tr } from '../../../i18n'

interface Props {
    view: CombatantView
    onOpenConditions: () => void
    onOpenAfflictions: () => void
    onOpenPersistent: () => void
    /** Nome na AON, ou `null` num combatente que não tem ficha para abrir. */
    sheetName: string | null
    sheetOpen: boolean
    onToggleSheet: () => void
    /** Só monstro sem escudo conhecido: abre o diálogo para definir um. */
    onDefineShield?: () => void
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
                    ? { backgroundColor: status.warning, '&:hover': { backgroundColor: WARNING_HOVER } }
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
    sheetName,
    sheetOpen,
    onToggleSheet,
    onDefineShield,
}: Props) => {
    const { name } = view.combatant
    const armed = useArmed()
    const reduced = useReducedMotion()

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
                label={tr("Condições", 'Conditions')}
                count={conditionCount}
                color={CONDITION_COLOR}
                title={tr("Marcar ou tirar condições", 'Mark or remove conditions')}
                ariaLabel={tr(`Condições de ${name}`, `${name}'s conditions`)}
                onClick={onOpenConditions}
            />
            <ActionButton
                icon={<AfflictionIcon sx={{ fontSize: '1rem' }} />}
                label={tr("Aflições", 'Afflictions')}
                count={view.afflictions.length}
                attention={saveDue}
                color={gold.deep}
                title={saveDue
                    ? tr('Salvaguarda de estágio vencida — informe o grau na caixa abaixo', 'Stage saving throw due — enter the degree in the box below')
                    : tr('Aplicar um veneno ou doença da AON', 'Apply a poison or disease from AON')}
                ariaLabel={tr(`Aflições de ${name}${saveDue ? ', salvaguarda pendente' : ''}`, `${name}'s afflictions${saveDue ? ', save pending' : ''}`)}
                onClick={onOpenAfflictions}
            />
            <ActionButton
                icon={<PersistentIcon sx={{ fontSize: '1rem' }} />}
                label={tr("Persistente", 'Persistent')}
                count={view.persistent.length}
                attention={checkDue}
                color={status.error}
                title={checkDue
                    ? tr('Teste plano pendente — informe o resultado na caixa abaixo', 'Flat check pending — enter the result in the box below')
                    : tr('Aplicar dano persistente (fogo, sangramento…)', 'Apply persistent damage (fire, bleed…)')}
                ariaLabel={tr(`Dano persistente de ${name}${checkDue ? ', teste plano pendente' : ''}`, `${name}'s persistent damage${checkDue ? ', flat check pending' : ''}`)}
                onClick={onOpenPersistent}
            />

            {/* Raise a Shield: é o botão que o GM mais aperta num turno de
                quem tem escudo, então fica na fileira escrita, não no menu. */}
            {view.shield ? (
                <Tooltip title={view.shield.broken
                    ? tr('Escudo quebrado: não pode ser erguido', 'Broken shield: can\'t be raised')
                    : view.shield.raised
                        ? tr('Abaixar o escudo (abaixa sozinho no início do próximo turno)', 'Lower the shield (it lowers by itself at the start of the next turn)')
                        : tr(`Levantar Escudo: +${view.shield.stats.bonus} de circunstância na CA`, `Raise a Shield: +${view.shield.stats.bonus} circumstance bonus to AC`)}
                >
                    <span style={{ display: 'inline-flex' }}>
                        <Button
                            size="small"
                            variant={view.shield.raised ? 'contained' : 'outlined'}
                            disabled={view.shield.broken && !view.shield.raised}
                            startIcon={
                                <ShieldIcon
                                    key={view.shield.raised ? 'up' : 'down'}
                                    sx={{
                                        fontSize: '1rem',
                                        animation: view.shield.raised && armed && !reduced ? `${lift} 380ms ease-out` : 'none',
                                    }}
                                />
                            }
                            onClick={() => view.setShieldRaised(!view.shield!.raised)}
                            aria-pressed={view.shield.raised}
                            aria-label={tr(`${view.shield.raised ? 'Abaixar' : 'Levantar'} o escudo de ${name}`, `${view.shield.raised ? 'Lower' : 'Raise'} ${name}'s shield`)}
                            sx={{
                                flex: '0 0 auto',
                                px: 1,
                                fontSize: '0.75rem',
                                ...(view.shield.raised
                                    ? { backgroundColor: gold.main, color: '#FFFFFF', '&:hover': { backgroundColor: lightCore.gold.deep } }
                                    : { color: SHIELD_COLOR, borderColor: SHIELD_COLOR + '66', '&:hover': { borderColor: SHIELD_COLOR } }),
                            }}
                        >
                            {view.shield.broken ? tr('Escudo quebrado', 'Broken shield') : view.shield.raised ? tr(`Escudo +${view.shield.stats.bonus}`, `Shield +${view.shield.stats.bonus}`) : tr('Levantar escudo', 'Raise shield')}
                        </Button>
                    </span>
                </Tooltip>
            ) : onDefineShield ? (
                <ActionButton
                    icon={<ShieldIcon sx={{ fontSize: '1rem' }} />}
                    label={tr("Escudo", 'Shield')}
                    count={0}
                    color={SHIELD_COLOR}
                    title={tr("Definir o escudo deste monstro (Dureza, PV, BT)", 'Set this monster\'s shield (Hardness, HP, BT)')}
                    ariaLabel={tr(`Definir escudo de ${name}`, `Set ${name}'s shield`)}
                    onClick={onDefineShield}
                />
            ) : null}

            {/* Este não abre diálogo, abre uma gaveta no próprio cartão — daí a
                seta à direita em vez de contagem, e o verde da moldura em vez de
                um dos três acentos de estado. Personagem não entra: a ficha dele
                é a Ficha Virtual, que já tem tudo e é da mesa. */}
            {sheetName && (
                <Tooltip title={sheetOpen ? tr('Fechar a ficha', 'Close the sheet') : tr(`Ver a ficha de ${sheetName} sem sair daqui`, `See ${sheetName}'s sheet without leaving`)}>
                    <Button
                        size="small"
                        variant={sheetOpen ? 'contained' : 'outlined'}
                        startIcon={<SheetIcon sx={{ fontSize: '1rem' }} />}
                        endIcon={
                            <ExpandIcon
                                sx={{
                                    fontSize: '1rem',
                                    transition: 'transform 150ms',
                                    transform: sheetOpen ? 'rotate(180deg)' : 'none',
                                }}
                            />
                        }
                        onClick={onToggleSheet}
                        aria-expanded={sheetOpen}
                        aria-label={tr(`${sheetOpen ? 'Fechar' : 'Ver'} a ficha de ${name}`, `${sheetOpen ? 'Close' : 'See'} ${name}'s sheet`)}
                        sx={{
                            flex: '0 0 auto',
                            px: 1,
                            fontSize: '0.75rem',
                            ...(sheetOpen
                                ? { backgroundColor: green.main, color: onFrame.paper, '&:hover': { backgroundColor: green.deepest } }
                                : { color: greenInk.main, borderColor: greenInk.main + '66', '&:hover': { borderColor: greenInk.main } }),
                        }}
                    >
                        {tr('Ficha', 'Sheet')}</Button>
                </Tooltip>
            )}
        </Stack>
    )
}
