import { useState } from 'react'
import { Box, Button, Card, CardContent, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { Edit as EditIcon } from '@mui/icons-material'
import { COIN_COLORS } from '../../../theme/palette'
import { COINS, MAX_COIN, type Purse } from '../money'
import type { MoneyApi } from './useMoney'
import { EmbedDialog } from './EmbedDialog'
import { useSheetReadOnly } from '../sheetAccess'
import { locale, tr } from '../../../i18n'

// Platina é "pl": "pp" já é prata, e as duas colidiam.
const COIN_LABEL: Record<keyof Purse, string> = { pp: tr('pl', 'pp'), gp: tr('po', 'gp'), sp: tr('pp', 'sp'), cp: tr('pc', 'cp') }
const COIN_NAME: Record<keyof Purse, string> = {
    pp: tr('Platina', 'Platinum'), gp: tr('Ouro', 'Gold'), sp: tr('Prata', 'Silver'), cp: tr('Cobre', 'Copper'),
}

/** O que foi digitado vira moeda: vazio é zero; negativo, fração ou acima do teto, inválido. */
const parseCoin = (raw: string): number | null => {
    const t = raw.trim()
    if (!t) return 0
    if (!/^\d+$/.test(t)) return null
    const n = Number(t)
    return n <= MAX_COIN ? n : null
}

/**
 * O dinheiro do personagem. O dono (e o GM) acertam na mesa o que ganharam e gastaram; a ficha de outra pessoa só
 * mostra. A edição vale enquanto a ficha publicada tiver o mesmo dinheiro de quando foi feita (`money.ts`).
 */
export function MoneyCard({ money }: { money: MoneyApi }) {
    const readOnly = useSheetReadOnly()
    const [draft, setDraft] = useState<Record<keyof Purse, string> | null>(null)
    const { purse, sheet, edited } = money

    const open = () => setDraft({ pp: String(purse.pp), gp: String(purse.gp), sp: String(purse.sp), cp: String(purse.cp) })
    const parsed = draft ? COINS.map((c) => parseCoin(draft[c])) : []
    const valid = parsed.every((v) => v !== null)
    const save = () => {
        if (!draft || !valid) return
        money.setPurse({ pp: parsed[0]!, gp: parsed[1]!, sp: parsed[2]!, cp: parsed[3]! })
        setDraft(null)
    }
    const reset = () => {
        money.setPurse(null)
        setDraft(null)
    }

    return (
        <Card>
            <CardContent>
                <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em', mr: 'auto' }}>
                        {tr('Dinheiro', 'Money')}
                    </Typography>
                    {edited && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            {tr('acertado na mesa', 'adjusted at the table')}
                        </Typography>
                    )}
                    {!readOnly && (
                        <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={open}>
                            {tr('Editar', 'Edit')}
                        </Button>
                    )}
                </Stack>
                <Stack direction="row" sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                    {COINS.map((c) => <Coin key={c} label={COIN_LABEL[c]} value={purse[c]} accent={COIN_COLORS[c]} />)}
                </Stack>
            </CardContent>
            <EmbedDialog open={!!draft} onClose={() => setDraft(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ pb: 1 }}>{tr('Editar dinheiro', 'Edit money')}</DialogTitle>
                <DialogContent>
                    <Box
                        component="form"
                        onSubmit={(e) => { e.preventDefault(); save() }}
                        sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 1.5, pt: 1 }}
                    >
                        {draft && COINS.map((c, i) => (
                            <TextField
                                key={c}
                                label={`${COIN_NAME[c]} (${COIN_LABEL[c]})`}
                                value={draft[c]}
                                onChange={(e) => setDraft({ ...draft, [c]: e.target.value })}
                                onFocus={(e) => e.target.select()}
                                error={parsed[i] === null}
                                size="small"
                                slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', 'aria-label': COIN_NAME[c] } }}
                            />
                        ))}
                        {/* Enter no campo salva. */}
                        <button type="submit" hidden />
                    </Box>
                    {!valid && (
                        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                            {tr('Use só números inteiros, de 0 a ', 'Use whole numbers only, from 0 to ')}{MAX_COIN.toLocaleString(locale)}.
                        </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                        {tr(
                            `Na ficha do Pathbuilder: ${sheet.pp} pl, ${sheet.gp} po, ${sheet.sp} pp, ${sheet.cp} pc. Se uma versão nova da ficha for publicada com outro dinheiro, vale o da ficha nova.`,
                            `On the Pathbuilder sheet: ${sheet.pp} pp, ${sheet.gp} gp, ${sheet.sp} sp, ${sheet.cp} cp. If a new version of the sheet is published with different money, the new sheet's wins.`,
                        )}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
                    {edited && <Button onClick={reset} sx={{ mr: 'auto' }}>{tr('Voltar ao da ficha', 'Back to the sheet')}</Button>}
                    <Button onClick={() => setDraft(null)}>{tr('Cancelar', 'Cancel')}</Button>
                    <Button variant="contained" onClick={save} disabled={!valid}>{tr('Salvar', 'Save')}</Button>
                </DialogActions>
            </EmbedDialog>
        </Card>
    )
}

const Coin = ({ label, value, accent }: { label: string; value: number; accent: string }) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 0.75,
            px: 1.5,
            py: 0.75,
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: accent + '55',
            backgroundColor: accent + '14',
        }}
    >
        <Typography sx={{ fontWeight: 700, color: accent }}>
            {value.toLocaleString(locale)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {label}
        </Typography>
    </Box>
)
