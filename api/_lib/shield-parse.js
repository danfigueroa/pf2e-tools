// Leitura dos números de escudo escritos em prosa — compartilhada entre a busca
// de escudos (`shield-core.js`, escudo específico) e a de criaturas
// (`creature-core.js`, o escudo que o monstro carrega).

// "Hardness 12, HP 90, BT 45" · "Hardness 15, HP 120, and BT 60" ·
// "Hardness 10, HP 80" (sem BT: pelo RAW, o BT é metade do PV) · "HP 20 (10)".
const STATS_RE = /Hardness\s+(\d+),?\s+(?:and\s+)?HP\s+(\d+)(?:\s*\((\d+)\))?(?:,?\s+(?:and\s+)?BT\s+(\d+))?/gi

function toStats(m) {
  const hp = parseInt(m[2], 10)
  const bt = m[4] ? parseInt(m[4], 10) : m[3] ? parseInt(m[3], 10) : Math.floor(hp / 2)
  return { hardness: parseInt(m[1], 10), hp, bt }
}

/** Dureza/PV/BT da primeira ocorrência na prosa, ou `null`. */
export function parseShieldStats(text) {
  const m = [...String(text || '').matchAll(STATS_RE)][0]
  return m ? toStats(m) : null
}

/**
 * O escudo de uma criatura, lido do texto do stat block.
 *
 * Só vale a ocorrência com "shield" logo antes: um constructo escreve a PRÓPRIA
 * dureza ("Hardness 5; HP 20" — com ponto e vírgula, que o regex já recusa),
 * e um escudo de verdade vem como "steel shield (Hardness 5, HP 20, BT 10)".
 * O bônus sai de "AC 20 (22 with shield raised)"; sem isso, o +2 de quase todo
 * escudo. `block` diz se a ficha tem a reação Shield Block.
 */
export function parseCreatureShield(text) {
  const prose = String(text || '')
  const m = [...prose.matchAll(STATS_RE)]
    .find((x) => /shield/i.test(prose.slice(Math.max(0, x.index - 120), x.index)))
  if (!m) return null
  const raised = /AC\s+(\d+)\s*\((\d+)\s+with\s+shield\s+raised/i.exec(prose)
  const bonus = raised ? Math.max(1, parseInt(raised[2], 10) - parseInt(raised[1], 10)) : 2
  return { bonus, ...toStats(m), block: /Shield Block/i.test(prose) }
}
