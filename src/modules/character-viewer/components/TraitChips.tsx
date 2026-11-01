import { memo, useState } from 'react'
import { Chip, Popover, Stack } from '@mui/material'
import { fetchRule, type AonRule } from '../../../services/rules'
import { traitTerm } from '../../monster-scaler/ruleTerms'
import { RuleBody } from '../../monster-scaler/components/RuleTip'

// Os traços de uma arma ("Deadly d10", "Volley 30 ft.", "Agile") como chips que, ao toque, abrem
// a regra do traço — direto da AON, em inglês, a mesma caixinha de regra do stat block do monstro
// (`fetchRule` com cache; a busca só acontece ao abrir, nunca no render). Toque e não passar o
// mouse, porque a ficha é usada no celular, e popover porque o tooltip some no meio da leitura.

const label = (raw: string) => raw.charAt(0).toUpperCase() + raw.slice(1)

/** Um chip por traço, sem repetir. O texto é o que a AON escreve (com o dado/alcance); a regra é do termo puro. */
export const TraitChips = memo(function TraitChips({ traits }: { traits: string[] }) {
  const [open, setOpen] = useState<{ el: HTMLElement; raw: string } | null>(null)
  const [rule, setRule] = useState<AonRule | null>(null)
  const [loading, setLoading] = useState(false)
  const unique = [...new Set(traits.map((t) => t.trim()).filter(Boolean))]
  if (unique.length === 0) return null

  const show = (el: HTMLElement, raw: string) => {
    setOpen({ el, raw })
    setRule(null)
    setLoading(true)
    void fetchRule(traitTerm(raw), 'trait').then((found) => {
      // Quem toca em outro traço antes da resposta não recebe a regra do anterior.
      setOpen((cur) => {
        if (cur?.raw === raw) { setRule(found); setLoading(false) }
        return cur
      })
    })
  }

  return (
    <>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.75, justifyContent: 'center' }}>
        {unique.map((t) => (
          <Chip
            key={t}
            label={label(t)}
            size="small"
            variant="outlined"
            clickable
            onClick={(e) => show(e.currentTarget, t)}
            aria-haspopup="dialog"
            aria-label={`Traço ${label(t)}: ler a regra`}
            sx={{ height: 22, fontSize: '0.7rem', borderStyle: 'dashed' }}
          />
        ))}
      </Stack>
      <Popover
        open={!!open}
        anchorEl={open?.el}
        onClose={() => setOpen(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: { maxWidth: 'min(420px, calc(100vw - 24px))', p: 1.5, border: '1px solid', borderColor: 'divider' } } }}
      >
        <RuleBody rule={rule} loading={loading} />
      </Popover>
    </>
  )
})
