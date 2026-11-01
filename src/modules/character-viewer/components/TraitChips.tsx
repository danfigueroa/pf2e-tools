import { memo, useEffect, useState } from 'react'
import { Chip, Popover, Stack } from '@mui/material'
import { fetchTraitRule, peekTraitRule, prefetchTraitRules, type AonRule } from '../../../services/rules'
import { traitLabel, traitName } from '../weaponTraits'
import { RuleBody } from '../../monster-scaler/components/RuleTip'

// Os traços de uma arma ("Deadly d10", "Volley 30 ft.", "Agile") como chips que, ao toque, abrem
// a regra do traço — direto da AON, em inglês, a mesma caixinha de regra do stat block do monstro
// (em português, já traduzida e guardada no banco pelo servidor; ver `prefetchTraitRules`). Toque e não passar o
// mouse, porque a ficha é usada no celular, e popover porque o tooltip some no meio da leitura.

/** Um chip por traço, sem repetir. O texto é o que a AON escreve (com o dado/alcance); a regra é do termo puro. */
export const TraitChips = memo(function TraitChips({ traits }: { traits: string[] }) {
  const [open, setOpen] = useState<{ el: HTMLElement; raw: string } | null>(null)
  const [rule, setRule] = useState<AonRule | null>(null)
  const [loading, setLoading] = useState(false)
  const unique = [...new Set(traits.map((t) => t.trim()).filter(Boolean))]
  // As regras já estão no banco do servidor: uma consulta em lote ao aparecer, e o toque lê da memória.
  const wanted = unique.map(traitName).join('|')
  // `tick` repinta os chips quando o nome em português (do servidor) chega.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (wanted) void prefetchTraitRules(wanted.split('|')).then(() => setTick((n) => n + 1))
  }, [wanted])
  if (unique.length === 0) return null

  const show = (el: HTMLElement, raw: string) => {
    setOpen({ el, raw })
    setRule(null)
    setLoading(true)
    void fetchTraitRule(traitName(raw)).then((found) => {
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
            label={traitLabel(t, peekTraitRule(traitName(t))?.label)}
            size="small"
            variant="outlined"
            clickable
            onClick={(e) => show(e.currentTarget, t)}
            aria-haspopup="dialog"
            aria-label={`Traço ${traitLabel(t, peekTraitRule(traitName(t))?.label)}: ler a regra`}
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
