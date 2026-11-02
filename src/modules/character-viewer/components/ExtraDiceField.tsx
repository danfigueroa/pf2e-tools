import { useState } from 'react'
import { TextField } from '@mui/material'
import type { DiceExpr } from '../../../dice/roll'
import { parseExtraDice } from '../../../dice/extraDice'
import { tr } from '../../../i18n'

interface Props {
    /** Avisa a cada mudança: `expr` só quando o texto é válido (vazio = `null`); `valid` trava o rolar. */
    onChange: (expr: DiceExpr | null, valid: boolean) => void
}

/**
 * Dados extras de dano, digitados: "2d6", "1d8+1d4". Como o ajuste fixo, entra cru — a rolagem os soma ao
 * dano e dobra no crítico, e confere com a mesa se o efeito empilha.
 */
export function ExtraDiceField({ onChange }: Props) {
    const [text, setText] = useState('')
    const parsed = parseExtraDice(text)
    return (
        <TextField
            label={tr('Dados extras de dano', 'Extra damage dice')}
            size="small"
            value={text}
            placeholder={tr('ex.: 2d6 ou 1d8+1d4', 'e.g. 2d6 or 1d8+1d4')}
            onChange={(e) => {
                const next = e.target.value.slice(0, 40)
                setText(next)
                const r = parseExtraDice(next)
                onChange(r.ok ? r.expr : null, r.ok)
            }}
            error={!parsed.ok}
            helperText={parsed.ok
                ? tr('Rolados à parte e somados ao dano; dobram no crítico.', 'Rolled separately and added to the damage; doubled on a critical.')
                : parsed.error}
            slotProps={{ htmlInput: { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } }}
            fullWidth
        />
    )
}
