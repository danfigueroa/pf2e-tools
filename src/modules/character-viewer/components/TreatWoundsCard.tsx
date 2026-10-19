import { useState } from 'react'
import { Alert, Box, Button, Card, CardContent, FormControlLabel, Snackbar, Switch, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { HealthAndSafety as TreatIcon } from '@mui/icons-material'
import { HP_COLOR } from '../../../theme/palette'
import type { BuildInfo } from '../../character-sheet/types'
import type { ConditionModifiers } from '../conditions'
import { skillCheck } from '../checks'
import { characterMaxHp, signed } from '../helpers'
import { hpKeyFor, legacyCharKey } from '../charId'
import { rollerIdentity, treatWoundsRoll } from '../rolls'
import { availableOptions, DEGREE_LABEL, healingDice } from '../treatWounds'
import { partFormula } from '../../../dice/tableRoll'
import { useHpTracker } from './useHpTracker'
import { postRoll } from '../../../services/rolls'

interface Notice {
    severity: 'success' | 'info' | 'warning' | 'error'
    text: string
    /** PV que a cura de fato devolveu (ou o dano tirado), para o Desfazer. */
    undo?: { current: number; temp: number }
}

/**
 * Tratar Ferimentos (Medicina, 10 minutos). O jogador escolhe a CD que a
 * proficiência permite; o app rola o teste e a cura juntos, manda ao feed da
 * mesa e soma o PV do personagem — a menos que o tratado seja outra pessoa.
 */
export const TreatWoundsCard = ({ build, mods }: { build: BuildInfo; mods: ConditionModifiers }) => {
    const check = skillCheck(build, 'medicine', mods)
    const options = availableOptions(check.rank)
    const hp = useHpTracker(hpKeyFor(build), characterMaxHp(build, mods.hpMaxDelta), legacyCharKey(build))
    const [chosen, setChosen] = useState<number | null>(null)
    const [onSelf, setOnSelf] = useState(true)
    const [notice, setNotice] = useState<Notice | null>(null)

    if (options.length === 0) return null
    // Padrão: a CD mais alta que a ficha permite; se o rank mudou, volta a uma válida.
    const option = options.find((o) => o.dc === chosen) ?? options[options.length - 1]

    const treat = () => {
        const { roll, degree, delta } = treatWoundsRoll(rollerIdentity(build), check.parts, option)
        void postRoll(roll)
        const c = roll.check!
        const dice = healingDice(degree)
        const head = `CD ${option.dc}: d20 ${c.d20} ${signed(c.mod)} = ${c.total} · ${DEGREE_LABEL[degree]}`
        const severity = degree === 'critFailure' ? 'error' : degree === 'failure' ? 'warning' : 'success'
        if (!dice || !roll.free) {
            setNotice({ severity, text: `${head} — nenhuma cura.` })
            return
        }
        const formula = partFormula(roll.free)
        if (!onSelf) {
            setNotice({ severity, text: `${head} · ${formula} = ${roll.free.total} ${dice.heals ? 'PV curados no alvo' : 'de dano no alvo'}.` })
            return
        }
        const before = { current: hp.current, temp: hp.temp }
        if (delta > 0) {
            const healed = hp.applyHealing(delta)
            setNotice({ severity, text: `${head} · ${formula} = ${delta} · +${healed} PV${healed < delta ? ' (PV cheio)' : ''}`, undo: before })
        } else {
            hp.applyDamage(-delta)
            setNotice({ severity, text: `${head} · ${formula} = ${-delta} de dano em você`, undo: before })
        }
    }

    return (
        <Card sx={{ mt: 2 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <TreatIcon sx={{ color: HP_COLOR }} />
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                        Tratar Ferimentos
                    </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Medicina {signed(check.total)} · 10 minutos. Escolha a CD: quanto mais alta, mais cura.
                </Typography>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    fullWidth
                    value={option.dc}
                    onChange={(_, v: number | null) => { if (v) setChosen(v) }}
                    sx={{ mb: 1.5, flexWrap: 'wrap' }}
                >
                    {options.map((o) => (
                        <ToggleButton key={o.dc} value={o.dc} sx={{ flexDirection: 'column', textTransform: 'none', lineHeight: 1.2, py: 0.75 }}>
                            <b>CD {o.dc}</b>
                            <span style={{ fontSize: '0.7rem' }}>2d8{o.bonus ? `+${o.bonus}` : ''} · {o.label}</span>
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <FormControlLabel
                        control={<Switch size="small" checked={onSelf} onChange={(e) => setOnSelf(e.target.checked)} />}
                        label="Em mim mesmo (soma ao meu PV)"
                    />
                    <Button variant="contained" startIcon={<TreatIcon />} onClick={treat} sx={{ fontWeight: 700 }}>
                        Tratar · CD {option.dc}
                    </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Sucesso: 2d8{option.bonus ? ` + ${option.bonus}` : ''} PV · crítico: 4d8{option.bonus ? ` + ${option.bonus}` : ''} · falha crítica: 1d8 de dano.
                    O alvo fica imune por 1 hora.
                </Typography>
            </CardContent>
            <Snackbar
                open={!!notice}
                autoHideDuration={12000}
                onClose={(_, reason) => { if (reason !== 'clickaway') setNotice(null) }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {notice ? (
                    <Alert
                        severity={notice.severity}
                        onClose={() => setNotice(null)}
                        action={notice.undo ? (
                            <Button color="inherit" size="small" onClick={() => { hp.restoreHp(notice.undo!); setNotice(null) }}>
                                Desfazer
                            </Button>
                        ) : undefined}
                    >
                        {notice.text}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </Card>
    )
}
