// Cálculo dos dados de dano de uma arma (compartilhado entre a ficha virtual e o PDF).

export interface WeaponDamageInput {
  die: string;
  str?: string | null;
  damageBonus: number;
  increasedDice?: boolean;
}

// Quantidade de dados de dano: 1 + um dado por grau da runa Striking.
export function strikingDice(striking: string | null | undefined): number {
  const s = (striking || '').toLowerCase()
  if (s.includes('major')) return 4
  if (s.includes('greater')) return 3
  if (s.includes('striking')) return 2
  return 1
}

// Aumento de um passo no dado (Deadly Simplicity, runas de inventor, …).
const DIE_STEPS = ['d4', 'd6', 'd8', 'd10', 'd12']
export function stepUpDie(die: string): string {
  const i = DIE_STEPS.indexOf((die || '').toLowerCase())
  return i >= 0 && i < DIE_STEPS.length - 1 ? DIE_STEPS[i + 1] : die
}

// Dados de dano já com Striking e aumento de passo aplicados: "2d6".
export function weaponDamageDice(weapon: WeaponDamageInput): string {
  const count = strikingDice(weapon.str)
  const raw = weapon.increasedDice ? stepUpDie(weapon.die) : weapon.die
  const die = raw.toLowerCase().startsWith('d') ? raw.toLowerCase() : `d${raw}`
  return `${count}${die}`
}

// Fórmula de dano da arma: "2d6+6". Não inclui o dano extra de runas/precisão.
export function weaponDamageFormula(weapon: WeaponDamageInput): string {
  const bonus = weapon.damageBonus
    ? (weapon.damageBonus > 0 ? `+${weapon.damageBonus}` : `${weapon.damageBonus}`)
    : ''
  return `${weaponDamageDice(weapon)}${bonus}`
}
