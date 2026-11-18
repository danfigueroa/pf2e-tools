# Escalar Monstro (`/escalar-monstro`, `src/modules/monster-scaler/`)

Adapta a ficha de uma criatura da AON para outro nível pelas tabelas de construção do GM Core (pg. 112-121, níveis -1 a 24).
Backend: `creature?name=` (`monster-core.js` + `creature-parse.js`). **Depois de mexer em `scaling.ts` ou nas tabelas, rode
`node scripts/check-scaling.mjs 200`** — é o teste que vale (identidade, monotonia, ida e volta, ajuste fino).

## Tabelas

- **Geradas, nunca digitadas**: `scripts/fetch-creature-tables.mjs` transcreve do índice da AON (categoria `rules`, fonte
  `GM Core`, tabelas em `<table>` HTML) para `data/creatureTables.ts`. **Confira o diff.** Armadilhas: travessão no nível
  negativo e nas faixas, traço longo para "não existe", PV e perícia Baixa em faixa, dano como `"4d12+42 (68)"`. Script
  reclamando de todas as tabelas de uma vez = a marcação do AON mudou (hoje `<table[^>]*>`).

## Armadilhas do índice da AON

- O degrau é o **mais próximo, não exato** (Bugbear Tormentor "CA Alta" com 20; a tabela diz 19): preserve a diferença.
- `attack_bonus_scale`/`strike_damage_scale` vêm **colapsados** nos degraus distintos e `attack_bonus`/
  `strike_damage_average` **ordenados** — nenhum casa por índice com os golpes (ver `formulaAverage`).
- Fora da faixa das tabelas (Tarrasque, 25) o degrau é a string `"undefined"`: `scale()` valida contra os degraus conhecidos.
- **Não passa pela tradução**: a prosa das habilidades fica em inglês de propósito.

## O motor (`scaling.ts`)

- **Preserva a DIFERENÇA em relação ao benchmark**, nunca o benchmark cru. Reescalar para o próprio nível devolve a ficha
  original (números, prosa caractere por caractere, conjuração inteira).
- **Origem usa o degrau da AON; destino usa o degrau escolhido** (escolhido dos dois lados cancela o ajuste fino).
- **PV usa razão**, não diferença. **Dano dos golpes**: dados da tabela do nível-alvo, modificador fixo absorve o desvio.
- **Não reescala, por decisão de produto**: prosa (salvo CDs e dano, abaixo), lista de magias (só CD e ataque), dano extra
  dos golpes (`riders`). Tudo isso vira `warnings` na página. **Nunca inventa número que o GM não conferiu.**
- **CDs na prosa** (`abilityDc.ts`): benchmark de CD de magia (`SPELL_DC_TABLE`), agrupadas **por valor** (CDs iguais seguem
  iguais). **Teste plano nunca escala** (e o `\b` depois do `\d+` no regex evita casar só o "1" de "DC 15"). CD igual ao
  `spell_dc` do índice usa o degrau de lá.
- **Dano na prosa** (`abilityDamage.ts`, tabela de Dano em Área, colunas ilimitado/limitado): por **razão** (a mesma conta do
  golpe dava `6d8-19` numa aura de 1d6). Só é dano o que tem tipo ao lado ou `damage` (o "1d4 rounds" da recarga não).
  Dano fixo sem dado fica de fora.
- `ScaleOverrides` fala duas línguas (`BenchColumn = ScaleColumn | AreaColumn`): `pick()` valida o degrau contra as colunas
  da linha; degrau inválido (de `localStorage` antigo) é ignorado.

## Conjuração (`spellcasting.ts`, GM Core pg. 122)

- Rank máximo = ⌈nível/2⌉; slots: 3 no topo se nível par, 2 se ímpar, 3 nos inferiores; cinco truques.
- **A escada anda inteira** preservando a forma; modo por bloco no ajuste fino: **Acompanham** (tudo anda o mesmo tanto, abrem
  ranks de baixo) ou **Originais** (cada magia fica, abrem os de cima). **O truque anda nos dois modos**, preservando a diferença.
- **Só abre o rank que o nível abriu** (não complete a escada de 1 ao topo: reescreveria fichas publicadas).
- **Contagem de slots preserva o desvio** da ficha. Espontânea: o número vem escrito na última magia do rank e é do grupo;
  preparada: o número de magias preparadas é o de slots (`×2` vale dois).
- Ritual intocado (sem linha no ajuste fino). Repetição (`Fear (2)`, `Charm (×3; …)`, `x3` no fim) é token da anotação e só
  faz sentido em preparada e inata.
- Espontânea não tem slot vazio enquanto souber alguma magia do rank. **Slot que abre fica VAZIO**, marcado e com aviso; lista
  que passou do número de slots vira aviso, nunca exclusão.
- **Lista editada à mão vira a nova origem** (`SpellEdits`, com o `level` em que foi montada). `SpellEditorDialog` é **totalmente
  controlado** (o nível muda com o diálogo aberto). A edição viaja para a Iniciativa (`spellEdits` em `NpcCombatant`).

## Stat block (`MonsterStatBlock.tsx`, subtree do `html2canvas`: hex literal)

- **Caixinha de regra** (`RuleTip.tsx`, `ruleTerms.ts`, `services/rules.ts`): regra da AON **em inglês** (decisão de produto;
  aqui o inglês PODE ser cacheado — é o resultado pretendido). Busca ao abrir, nunca no render. Nome sem o anexo da ficha
  ("reach 15 feet" → `Reach`, `traitTerm`). Condições pelo `en` de `conditions.ts` (inclui `flat-footed`). O tracejado entra no
  PNG de propósito; chip de traço sem tracejado.
- "Enviar para Iniciativa" grava direto no `localStorage` do encontro (`appendCombatants`) e navega (seguro: a Iniciativa só
  escreve montada). Busca compartilhada: `src/hooks/useCreatureSearch.ts`.
