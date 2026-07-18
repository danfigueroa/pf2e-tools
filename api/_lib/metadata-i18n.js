// Tradução determinística pt-BR para os metadados curtos e padronizados das
// magias do AON (range/area/targets/duration/defense). Evita gastar uma chamada
// Groq por campo e mantém vocabulário consistente. Compartilhado entre as
// funções serverless (api/) e o servidor de dev (server/index.mjs).
//
// A ORDEM IMPORTA: regras de frase (que reordenam/concordam) vêm antes das
// regras de palavra isolada, senão a palavra é traduzida antes da frase casar.

const METADATA_DICTIONARY = [
  // ---- Frases com reordenação/concordância ----------------------------------
  // "120-foot line" → "line de 120 pés" (a forma é traduzida pelas regras abaixo)
  [/\b(\d+)[- ]foot[- ]radius ((?:sphere|cylinder|burst|emanation|circle)s?)\b/gi, '$2 de $1 pés de raio'],
  [/\b(\d+)[- ]foot ((?:line|cone|burst|emanation|cube|radius|square|sphere|cylinder|wall)s?)\b/gi, '$2 de $1 pés'],
  [/\b(\d+)[- ]mile ((?:line|cone|burst|emanation|radius)s?)\b/gi, '$2 de $1 milhas'],
  // "basic Reflex" → "Reflex básico" (o save é traduzido pelas regras abaixo);
  // \s+ porque o texto do AON às vezes vem com espaços duplos.
  [/\bbasic\s+(Reflex|Fortitude|Will)\b/gi, '$1 básico'],
  [/\bwith the\s+(\w+)\s+trait\b/gi, 'com o traço $1'],
  [/\bunder your control\b/gi, 'sob seu controle'],
  [/\bwilling living creatures\b/gi, 'criaturas vivas dispostas'],
  [/\bwilling living creature\b/gi, 'criatura viva disposta'],
  [/\bliving creatures\b/gi, 'criaturas vivas'],
  [/\bliving creature\b/gi, 'criatura viva'],
  [/\bwilling creatures\b/gi, 'criaturas dispostas'],
  [/\bwilling creature\b/gi, 'criatura disposta'],
  [/\bdead creatures\b/gi, 'criaturas mortas'],
  [/\bdead creature\b/gi, 'criatura morta'],
  [/\bdying creature(s)?\b/gi, 'criatura$1 morrendo'],
  [/\banimal companions\b/gi, 'companheiros animais'],
  [/\banimal companion\b/gi, 'companheiro animal'],
  [/\bunattended objects\b/gi, 'objetos desacompanhados'],
  [/\bunattended object\b/gi, 'objeto desacompanhado'],
  [/\ball creatures in the area\b/gi, 'todas as criaturas na área'],
  [/\bthe (?:start|beginning) of\b/gi, 'o início de'],
  [/\bthe end of\b/gi, 'o fim de'],
  [/\byour next turn\b/gi, 'seu próximo turno'],
  [/\byour next daily preparations\b/gi, 'suas próximas preparações diárias'],
  [/\buntil dismissed\b/gi, 'até ser dissipada'],
  [/\bof level (\d+) or lower\b/gi, 'de nível $1 ou menor'],
  [/\bof level (\d+) or higher\b/gi, 'de nível $1 ou maior'],
  [/\bwithin range\b/gi, 'dentro do alcance'],
  [/\bsee text\b/gi, 'ver texto'],
  [/\byou and up to\b/gi, 'você e até'],
  [/\bup to\b/gi, 'até'],

  // ---- Distâncias e tempo ---------------------------------------------------
  [/\bfeet\b/gi, 'pés'],
  [/\bfoot\b/gi, 'pé'],
  [/\bmile(s)?\b/gi, 'milha$1'],
  [/\bround(s)?\b/gi, 'rodada$1'],
  [/\bturn(s)?\b/gi, 'turno$1'],
  [/\bminute(s)?\b/gi, 'minuto$1'],
  [/\bhour(s)?\b/gi, 'hora$1'],
  [/\bday(s)?\b/gi, 'dia$1'],
  [/\bweek(s)?\b/gi, 'semana$1'],
  [/\bmonths\b/gi, 'meses'],
  [/\bmonth\b/gi, 'mês'],
  [/\byear(s)?\b/gi, 'ano$1'],

  // ---- Alcance/duração especiais -------------------------------------------
  [/\btouch\b/gi, 'toque'],
  [/\bself\b/gi, 'próprio'],
  [/\bvaries\b/gi, 'varia'],
  [/\bunlimited\b/gi, 'ilimitado'],
  [/\bplanetary\b/gi, 'planetário'],
  [/\binterplanar\b/gi, 'interplanar'],
  [/\bsight\b/gi, 'visão'],
  [/\bsustained\b/gi, 'sustentada'],
  [/\binstantaneous\b/gi, 'instantâneo'],
  [/\bpermanent\b/gi, 'permanente'],
  [/\bconcentration\b/gi, 'concentração'],
  [/\bspecial\b/gi, 'especial'],

  // ---- Alvos ----------------------------------------------------------------
  [/\bcreature(s)?\b/gi, 'criatura$1'],
  [/\bwilling\b/gi, 'disposta'],
  [/\bliving\b/gi, 'viva'],
  [/\bundead\b/gi, 'morto-vivo'],
  [/\ballies\b/gi, 'aliados'],
  [/\bally\b/gi, 'aliado'],
  [/\benemies\b/gi, 'inimigos'],
  [/\benemy\b/gi, 'inimigo'],
  [/\byourself\b/gi, 'você mesmo'],
  [/\byou\b/gi, 'você'],
  [/\byour\b/gi, 'seu'],
  [/\banimals\b/gi, 'animais'],
  [/\banimal\b/gi, 'animal'],
  [/\bplant(s)?\b/gi, 'planta$1'],
  [/\bconstruct(s)?\b/gi, 'constructo$1'],
  [/\bobject(s)?\b/gi, 'objeto$1'],
  [/\bitems\b/gi, 'itens'],
  [/\bitem\b/gi, 'item'],
  [/\bcorpses\b/gi, 'cadáveres'],
  [/\bcorpse\b/gi, 'cadáver'],
  [/\btarget(s)?\b/gi, 'alvo$1'],
  [/\bspell(s)?\b/gi, 'magia$1'],
  [/\blevels\b/gi, 'níveis'],
  [/\blevel\b/gi, 'nível'],

  // ---- Área -----------------------------------------------------------------
  [/\bemanation(s)?\b/gi, 'emanação$1'],
  [/\bburst(s)?\b/gi, 'estouro$1'],
  [/\bcone(s)?\b/gi, 'cone$1'],
  [/\blines\b/gi, 'linhas'],
  [/\bline\b/gi, 'linha'],
  [/\bcube(s)?\b/gi, 'cubo$1'],
  [/\bsquare(s)?\b/gi, 'quadrado$1'],
  [/\bradius\b/gi, 'raio'],
  [/\bsphere(s)?\b/gi, 'esfera$1'],
  [/\bcylinder(s)?\b/gi, 'cilindro$1'],
  [/\bwall(s)?\b/gi, 'parede$1'],

  // ---- Defesa ---------------------------------------------------------------
  [/\bWill\b/g, 'Vontade'],
  [/\bReflex\b/g, 'Reflexos'],
  [/\bFortitude\b/g, 'Fortitude'],
  [/\bAC\b/g, 'CA'],
  [/\bbasic\b/gi, 'básico'],
  [/\bsave\b/gi, 'salvamento'],

  // ---- Conectivos (por último: são curtos e aparecem dentro de frases) ------
  [/\buntil\b/gi, 'até'],
  [/\bwithin\b/gi, 'dentro de'],
  [/\beach\b/gi, 'cada'],
  [/\bper\b/gi, 'por'],
  [/\blower\b/gi, 'menor'],
  [/\bhigher\b/gi, 'maior'],
  [/\bunder\b/gi, 'sob'],
  [/\bcontrol\b/gi, 'controle'],
  [/\btrait(s)?\b/gi, 'traço$1'],
  [/\bor\b/gi, 'ou'],
  [/\band\b/gi, 'e'],
  // Artigos por último (curtos demais; só depois de tudo virar pt-BR).
  // Substantivos masculinos já traduzidos ganham "um"; o resto, "uma".
  [/\ban? ((?:objeto|cadáver|aliado|inimigo|animal|item|alvo|constructo|morto-vivo|cone|estouro|cubo|quadrado|cilindro|raio|turno|minuto|dia|ano|mês|nível|salvamento|traço)\b)/gi, 'um $1'],
  [/\ban\b/gi, 'uma'],
  [/\ba\b/g, 'uma'],
]

export function translateMetadata(text) {
  if (!text) return text
  let out = String(text)
  for (const [re, sub] of METADATA_DICTIONARY) {
    out = out.replace(re, sub)
  }
  // O texto do AON às vezes traz espaços duplos e espaço antes de vírgula.
  return out.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim()
}
