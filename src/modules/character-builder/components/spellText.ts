import { isEn, tr } from '../../../i18n'
import type { RuleEntry } from '../rules/types'
import namesPt from './spellNames.pt.json'

/** Traduz só a apresentação. O nome original ainda identifica a descrição e a Ficha. */
export function spellName(e: RuleEntry): string {
  return !isEn && !e.homebrew && Object.hasOwn(namesPt, e.name) ? (namesPt as Record<string, string>)[e.name] : e.name
}

/** "Truque", "Rank 3", "Ritual 2": o que a magia é, na língua da tela. */
export function spellKind(e: RuleEntry): string {
  const rank = e.spell?.rank ?? e.level ?? 0
  if (e.spell?.ritual || e.type === 'ritual') return tr(`Ritual ${rank}`, `Ritual ${rank}`)
  if (e.spell?.cantrip) return e.spell?.focus ? tr('Truque de foco', 'Focus cantrip') : tr('Truque', 'Cantrip')
  return e.spell?.focus ? tr(`Foco ${rank}`, `Focus ${rank}`) : tr(`Rank ${rank}`, `Rank ${rank}`)
}
