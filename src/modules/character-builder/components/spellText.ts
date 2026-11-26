import { tr } from '../../../i18n'
import type { RuleEntry } from '../rules/types'

/** "Truque", "Rank 3", "Ritual 2": o que a magia é, na língua da tela. */
export function spellKind(e: RuleEntry): string {
  const rank = e.spell?.rank ?? e.level ?? 0
  if (e.spell?.ritual || e.type === 'ritual') return tr(`Ritual ${rank}`, `Ritual ${rank}`)
  if (e.spell?.cantrip) return e.spell?.focus ? tr('Truque de foco', 'Focus cantrip') : tr('Truque', 'Cantrip')
  return e.spell?.focus ? tr(`Foco ${rank}`, `Focus ${rank}`) : tr(`Rank ${rank}`, `Rank ${rank}`)
}
