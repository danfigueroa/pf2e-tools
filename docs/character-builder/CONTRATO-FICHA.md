# Contrato da ficha: o modelo compilado que o modo jogar lê

**Não há export.** O compilador gera o **retrato aplicado** do personagem e o grava direto em `sheets` quando o jogador
toca "Aplicar na mesa". Este documento é o **contrato** desse retrato: cada campo, de onde o compilador o tira e quem o
consome.

O retrato tem duas camadas:

1. **Núcleo compatível** — exatamente o `BuildInfo` que a Ficha já lê (`src/pathbuilder/types.ts`), guardado como
   `{ success: true, build }`. Serve para que nada na Ficha, na Iniciativa, na Transformação, no Mapa e no servidor
   (preparo de descrições, guia por IA, aquecimento da AON) precise mudar no dia em que o Criador entrar. É o mesmo
   formato que o upload do Pathbuilder produz, e por isso os dois caminhos convivem na transição.
2. **Extensões do Criador** (§7) — o que o Pathbuilder nunca exportou: ids de conteúdo, memória de cálculo,
   desarmados, efeitos de talento, regras opcionais ativas. A Ficha passa a lê-las aos poucos (ROADMAP F7 e F10), e cada
   leitura nova aposenta um catálogo por nome ou um conserto do `normalizeBuild`.

O JSON do Pathbuilder deixa de ser o caminho e vira só **formato de importação** (§9) e download de backup.

Fonte: os 10 JSONs do elenco (`public/characters/*.json`), `ardagar8.json` e os consumidores na Ficha.

## 1. Identidade

| Campo | Exemplo | Origem no Criador | Consumidor |
| --- | --- | --- | --- |
| `name` | `"Thalos Alba"` | `state.name` | slug (hoje), título da Ficha, Iniciativa (`sheetName`) |
| `class` | `"Magus"` | nome canônico da classe | `classOf`, regras de classe (`rage.ts`, `magus.ts`…) |
| `dualClass` | `null` | `state.class.dual` | — (Ficha não trata; aviso) |
| `level` / `xp` | `10` / `0` | `state.level` / `state.xp` | tudo |
| `ancestry` / `heritage` / `background` | `"Human"` / `"Aiuvarin"` / `"Nomad"` | nomes canônicos | Visão Geral, descrições |
| `alignment` | `"N"` | fixo `"N"` (Remaster não tem tendência; manter o campo) | — |
| `gender` / `age` | `"Not set"` | `state.details` ou `"Not set"` | Visão Geral |
| `deity` | `"Not set"` | divindade escolhida | Clérigo/Campeão |
| `size` / `sizeName` | `2` / `"Medium"` | da ancestralidade/efeitos (0 Tiny … 5 Gargantuan) | Mapa (token), `sizeEffects.ts` |
| `keyability` | `"wis"` | atributo-chave | CD de classe |
| `languages` | `["Common","Draconic"]` (ou `["None selected"]`) | idiomas | Visão Geral |

## 2. Atributos e números base

| Campo | Formato | Origem |
| --- | --- | --- |
| `abilities` | `{ str, dex, con, int, wis, cha }` em **pontuação** (`10 + 2×mod`, +1 com parcial pendente) | MOTOR §2 |
| `abilities.breakdown` | `{ ancestryFree: ["Dex"], ancestryBoosts: ["Con"], ancestryFlaws: [], backgroundBoosts: [...], classBoosts: [...], mapLevelledBoosts: { "1": [...], "5": [...] } }` (rótulos `Str/Dex/Con/Int/Wis/Cha`) | escolhas de boost |
| `attributes` | `{ ancestryhp, classhp, bonushp, bonushpPerLevel, speed, speedBonus }` | MOTOR §5 |
| `proficiencies` | bônus **sem nível** (0/2/4/6/8) para `classDC, perception, fortitude, reflex, will, heavy, medium, light, unarmored, advanced, martial, simple, unarmed, castingArcane, castingDivine, castingOccult, castingPrimal` e as 16 perícias (+ `piloting`, `computers` = 0) | MOTOR §3 |
| `specificProficiencies` | `{ trained: [], expert: [], master: [], legendary: [] }` (nomes de arma/grupo) | MOTOR §3 |
| `mods` | `{ "Fortitude": { "Item Bonus": 1 }, "Arcana": { "Item Bonus": 1 } }` | itens investidos/runas (resiliente) |
| `acTotal` | `{ acProfBonus, acAbilityBonus, acItemBonus, acTotal, shieldBonus: null }` (`acProfBonus` **com** nível) | MOTOR §6 |
| `resistances` | `["poison 4"]` | MOTOR §6 (inclui item — fim do `addItemResistances`) |
| `lores` | `[["Academia", 2]]` (bônus sem nível) | MOTOR §4 |
| `inventorMods` | `[]` | Inventor (fase 9) |

## 3. Talentos e habilidades

### `feats`: tupla do Pathbuilder

```
[ nome, qualificador | null, tipo, nível, rótuloDoSlot?, tipoDeEscolha?, rótuloDoPai? ]
```

| Posição | Exemplo | Regra no Criador |
| --- | --- | --- |
| 0 nome | `"Assurance"` | nome canônico em inglês |
| 1 qualificador | `"Deception"` / `null` | `Choice.qualifier` traduzido para o nome canônico |
| 2 tipo | `"Class Feat"`, `"Ancestry Feat"`, `"Skill Feat"`, `"General Feat"`, `"Archetype Feat"`, `"Mythic Feat"`, `"Heritage"`, `"Awarded Feat"`, ou o de outra lista (`"Psychic Feat"`, `"Reincarnation Feat"`) | categoria do talento **escolhido** (não do slot) |
| 3 nível | `4` | nível do slot |
| 4 rótulo do slot | `"Magus Feat 4"`, `"Free Archetype 4"`, `"Mythic Feat 2"`, `"Skill Feat 2"`, `"Heritage Feat"`, `"General Training FeatHuman Feat"` | gerado a partir da chave do slot (o `featGroups.ts` e o `parseFeatEntry` só leem 0–3 hoje; manter 4–6 por compatibilidade e para a importação reversa) |
| 5 tipo de escolha | `"standardChoice"`, `"parentChoice"`, `"childChoice"` | slot comum / talento que concede / talento concedido |
| 6 rótulo do pai | `"Free Archetype 4"` | só em `childChoice` |

Talentos concedidos sem slot: tipo `"Awarded Feat"`, rótulo ausente (como o export faz com Shield Block do Guerreiro).

### `specials`

Lista de nomes de características (classe, ancestralidade, herança, sentidos): `["Spellstrike", "Arcane Cascade",
"Darkvision", "Scent (imprecise) 30 feet"]`. Regras do Criador (fecham os consertos do `normalizeBuild`):

- **Não** incluir tamanhos (`dropSizeSpecials` deixa de agir).
- Path to Perfection com a escolha: `"Path to Perfection (Will)"` (`fixPathToPerfection` deixa de agir).
- Nome que a AON resolve (o mesmo que `specialLookupName` espera; ex. "Weapon Expertise" sem a classe — a Ficha
  acrescenta).

## 4. Equipamento

| Campo | Formato | Regra |
| --- | --- | --- |
| `weapons[]` | `{ name, qty, prof, die, pot, str, mat, display, runes, damageType, attack, damageBonus, extraDamage, increasedDice, isInventor, grade }` | `name` = base canônica ("Longsword"); `display` = nome personalizado ou "+1 Striking Longsword"; `prof` = `simple/martial/advanced/unarmed`; `str` = `""/"striking"/"greaterStriking"/"majorStriking"`; `mat` = `"Cold Iron (Low-Grade)"` ou `null`; `runes` = propriedade (`["Flaming"]`); `damageType` = `S/P/B` ou o nome; `attack`/`damageBonus` **totais** (MOTOR §7) |
| desarmados | entradas em `weapons[]` com `prof: "unarmed"` | **novo**: o Pathbuilder não exporta. Quando a Ficha passar a ler isto, o catálogo `unarmed.ts` vira só reserva para fichas antigas (fase 7, com casos no `check-rolls`) |
| `armor[]` | `{ name, qty, prof, pot, res, mat, display, worn, runes, grade }` | `res` = `""/"resilient"/"greaterResilient"/"majorResilient"`; `worn` só uma armadura; escudo também entra aqui (como no export) |
| `equipment[]` | `[nome, qtd, "Invested"?]` no inventário principal. No contêiner, a amostra traz `[nome, qtd, idDoContêiner, "Invested"]`. | Se o terceiro elemento for uma chave de `equipmentContainers`, ele indica o contêiner. O literal `"Invested"` aparece na quarta posição dessa tupla e também na terceira nos exports sem contêiner. |
| `equipmentContainers` | `{ "<uuid>": { containerName, bagOfHolding, backpack, augmentations } }` | O item aponta para a chave do contêiner. Na amostra, `backpack` é `true` e `bagOfHolding` e `augmentations` são `false`. |
| `money` | `{ cp, sp, gp, pp }` | `state.money` depois das compras |
| `formula` | Lista de grupos `{ type, known: string[] }` | A fórmula adquirida de `Bedroll` saiu em `{ "type": "other", "known": ["Bedroll"] }`. Uma lista vazia representa um livro sem fórmulas. |

A [amostra da F0.7](../../scripts/rules-data/samples/pathbuilder-inventory-formula.json) foi exportada pelo Pathbuilder
Feylines 112.0 de um personagem de teste. O Pathbuilder incluiu `"Invested"` no `Bedroll`, embora o item tenha sido
apenas movido para a mochila. Ao importar, preserve o vínculo pelo ID do contêiner e só trate o marcador como investimento
efetivo se o item puder ser investido.

## 5. Magias

| Campo | Formato |
| --- | --- |
| `spellCasters[]` | `{ name, magicTradition, spellcastingType, ability, proficiency, focusPoints, innate, perDay[11], spells[{ spellLevel, list }], prepared[{ spellLevel, list }], blendedSpells }` |
| `focusPoints` | pool **pelo Remaster** (fecha o `fixFocusPool`) |
| `focus` | `{ "<tradição>": { "<atributo>": { abilityBonus, proficiency, itemBonus, focusCantrips[], focusSpells[] } } }` |
| `rituals` | `["Heartbond"]` |

Regras:

- **Preparado de grimório** (Mago, Magus, arquétipo de Mago): `spells` = grimório **e** `prepared` = do dia. Gerar já
  com `spells` preenchido (o `normalizeSpellCasters` continua idempotente).
- `perDay[rank]` = slots do rank (índice 0 = truques). Magus: sem slots que a classe não tem.
- Conjurador inato: `innate: true`, `perDay` com os usos.
- `name` do conjurador = o que a Ficha casa por nome (`"Magus"`, `"Archetype Wizard"`, `"Cleric Font"`, `"Mythic Magic"`,
  `"Caster Arcane Sense"`). Manter **os mesmos nomes** que o Pathbuilder usa (lista no `check-builder`).
- `spellDescriptions`, `featDescriptions`, `specialDescriptions`, `petDescriptions`: **não** gerar (vêm do preparo da
  publicação).

## 6. Companheiros

| Campo | Formato |
| --- | --- |
| `pets[]` | `{ type: "Animal Companion", name, animal, mature, incredible, incredibleType, specializations, armor, equipment }` |
| `familiars[]` | `{ name, type, abilities[] }` |

## 7. Extensões do Criador (opcionais; o upload do Pathbuilder não as tem)

Ficam todas sob `build.covil` para não colidir com campo do Pathbuilder. Quem lê testa a presença e cai no
comportamento atual quando falta (ficha antiga, upload).

| Campo | Para quê | Quem passa a ler | Aposenta |
| --- | --- | --- | --- |
| `covil.buildId`, `rulesVersion`, `schema` | A Ficha sabe que pode abrir o modo editar | Ficha (botão "Editar") | — |
| `covil.warnings` | Avisos do motor no momento de aplicar ("aplicada com 2 avisos") | Ficha (Visão Geral) | — |
| `covil.ids` | `{ "feat:Power Attack": "feat:power-attack", … }` — nome → id de conteúdo | Descrições, `featGroups.ts` | casamentos por nome ambíguos (`namesCompatible` no cliente) |
| `covil.breakdown` | Memória de cálculo de cada número (CA, salvaguardas, perícias, ataques) com a origem de cada parcela | `checks.ts`, diálogo de rolagem | parte da reconstrução de parcelas da Ficha |
| `covil.unarmed` | Ataques desarmados completos (ancestralidade, talento, classe) | `strikes.ts` | `unarmed.ts` (fica como reserva para fichas antigas) |
| `covil.resistances` com origem | Resistências com o item/talento que as dá | Visão Geral, Iniciativa | `addItemResistances` |
| `covil.effects` | Efeitos permanentes que o motor aplicou e os **situacionais** que ele reconheceu mas deixou para a Ficha (rule elements com predicado de combate) | Ficha (chips de situação) | parte de `magicWeapons.ts`, `itemActivities.ts` |
| `covil.variants` | Regras opcionais ativas (Free Archetype, Mítico + chamado + destino, ABP, PwL) | Ficha, Iniciativa (PwL, ABP) | — |
| `covil.mythic` | `{ calling, destiny, rank }` | Faixa mítica da Ficha | detecção "é mítico se tem Mythic Feat" |
| `covil.slots` | Slot de cada talento com a chave estável | Aba Talentos (agrupamento) | rótulos `"Magus Feat 4"` |

Regra: extensão nova = linha nesta tabela + o leitor na Ficha com fallback + caso no `check-builder` e, se mexer em
rolagem, no `check-rolls`.

## 8. Invariantes (checados no `compileBuild` e no `check-builder`)

1. `parseCharacterJson(output)` não lança.
2. `normalizeBuild(output)` é **idempotente** sobre a saída do Criador (não muda nada) — prova de que os consertos do
   export não são mais necessários.
3. `JSON.stringify(output).length` ≤ 64 KB.
4. Todo nome (talento, magia, item, característica) existe no catálogo de regras (logo, resolve na AON).
5. `acTotal.acTotal = 10 + acProfBonus + acAbilityBonus + acItemBonus`.
6. `abilities` coerente com `breakdown`.
7. `weapons[].attack` = conta do MOTOR §7 (ou override marcado).
8. `perDay` só tem slot onde a tabela da classe tem.

## 9. Importação reversa (Pathbuilder → `BuildState`)

Para migrar os personagens atuais sem refazer à mão (RF-008):

1. Origem: `ancestry`, `heritage`, `background`, `class`, `deity` → ids do catálogo (por nome, com `namesCompatible`).
2. Atributos: `abilities.breakdown` → `choices['boosts-N']`.
3. Perícias: comparar `proficiencies`/`lores` com o que a origem/classe dão; a diferença vira treinos/aumentos (quando a
   ordem por nível não é recuperável, distribuir pelo nível mais baixo possível e marcar `history: import`).
4. Talentos: a tupla (rótulo do slot, `parentChoice`/`childChoice`) diz o slot; sem rótulo, inferir pelo tipo e nível.
5. Inventário: `weapons`, `armor`, `equipment`, `money`, contêineres.
6. Magias: `spellCasters` → `spellcasting[...]`.
7. Companheiros.
8. Recompilar e **comparar** com o JSON importado; cada diferença vira item num relatório "o que não bateu" (é o mesmo
   relatório da paridade do `check-builder`).
9. O slug do build = o slug da ficha publicada (respeitando `SLUG_ALIASES`).
