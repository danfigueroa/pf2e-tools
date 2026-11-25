# Motor de regras do Criador

O motor transforma escolhas (`BuildState`) em números (`BuildInfo`). Este documento lista **o que** ele calcula e **de
onde** vem cada regra. Regra global 8: **nenhuma regra entra no código de memória**. Cada linha tem um status:

- **🔎 Conferir na AON** — escrito aqui como hipótese de trabalho; a sub-task de implementação começa conferindo a página
  da AON (Remaster; a revisada é a entrada com `legacy_id`) e anotando a referência (livro + página) no código.
- **🧪 Visto no export** — confirmado pelos números dos 10 JSONs do elenco; ainda assim vira caso no `check-builder`.
- **📦 Dado** — não é fórmula: vem do catálogo de regras (por classe/ancestralidade/item), não de código.

O que o motor não sabe aplicar vira **aviso**, nunca número aproximado.

---

## 1. Ordem de compilação

1. Coleta de origem e classe (+ variantes da mesa).
2. Expansão de concessões por nível até o 20 (características de classe, concessões de herança/background, talentos já
   escolhidos com `GrantItem`/`ChoiceSet`) → **slots**.
3. Atributos até o nível atual.
4. Proficiências (ranks) até o nível atual.
5. Derivados (PV, CA, salvaguardas, Percepção, perícias, CD de classe, velocidade, sentidos, resistências).
6. Equipamento (itens, runas, investidos, carga) → armas, armaduras, escudo, `mods` de item.
7. Conjuração (conjuradores, slots, foco, inatos).
8. Export + invariantes.

Cada número sai com sua **memória de cálculo** (`breakdown`): lista de parcelas `{ label, value, source }`, a mesma ideia
do diálogo de rolagem da Ficha ("Mestre +16 · CON +4 · Item +1").

## 2. Atributos

| Regra | Status |
| --- | --- |
| Remaster trabalha com **modificadores**; o export guarda "pontuação" (`str: 19`) = `10 + 2 × mod`, +1 quando há boost parcial pendente | 🧪 (Loki DES 19 = +4 com parcial; Thalos INT 19, CAR 20) |
| Nível 1: boosts da ancestralidade (fixos + livre, ou dois livres na opção alternativa), flaws, background (1 de 2 opções + 1 livre), classe (atributo-chave), 4 livres; dentro de cada grupo, atributos distintos | ✅ Player Core pg. 17, 23 e 84 (`engine/attributes.ts`) |
| Níveis 5, 10, 15, 20: 4 boosts em atributos distintos | 🧪 (`mapLevelledBoosts` com "1","5","10") / 🔎 |
| Boost em modificador +4 ou maior é **parcial**; dois parciais = +1 | ✅ Player Core pg. 17 |
| Flaw = −1; flaw voluntário, no máximo um por atributo | ✅ Player Core pg. 17 e 23 |
| Override manual: substitui o modificador final e gera aviso `ATTR_OVERRIDE` | — |
| `breakdown` do export: `ancestryFree`, `ancestryBoosts`, `ancestryFlaws`, `backgroundBoosts`, `classBoosts`, `mapLevelledBoosts` (rótulos `Str`/`Dex`…) | 🧪 |

## 3. Proficiência

| Regra | Status |
| --- | --- |
| Rank 0–4 (destreinado, treinado, perito, mestre, lendário); o **export guarda o bônus sem nível** (0/2/4/6/8) em `proficiencies` | 🧪 (Thalos `occultism: 6` = mestre) |
| Bônus de proficiência = rank × 2 + nível, e 0 se destreinado | ✅ Player Core pg. 11 / 🧪 (`acProfBonus: 12` no Thalos nível 10 treinado) |
| Proficiency Without Level: sem o nível | 🔎 GM Core (variante) |
| Rank final = maior rank concedido até o nível (nunca soma) | 🔎 |
| Teto de perícia por nível: mestre a partir do 7, lendário a partir do 15 (aviso `SKILL_RANK_CAP`) | ✅ Player Core pg. 92 |
| Fontes de rank: inicial da classe (📦), características por nível (📦, ex. "Weapon Expertise 5"), talentos (rule elements), aumentos de perícia (escolha) | — |
| `specificProficiencies` (armas/grupos específicos, ex. Weapon Mastery no grupo escolhido) | 🔎 + 📦 (`MartialProficiency` do Foundry) |

## 4. Perícias

| Regra | Status |
| --- | --- |
| Treino inicial: fixas da classe + N da classe + modificador de INT | 📦 (`trainedSkills.additional`) / ✅ Player Core pg. 225 |
| Perícia que já viria treinada de duas fontes: a segunda vira treino livre | ✅ Player Core pg. 84 e 225 |
| Aumentos de perícia nos níveis da classe (`skillIncreaseLevels`, maioria 3,5,7…19; Ladino e Investigador diferentes) | 📦 |
| Total da perícia = proficiência + atributo + item (`mods`) − penalidade de armadura (FOR/DES, quando a FOR não alcança) | 🔎 / a Ficha já faz o resto (`checks.ts`) |
| Lores: background (📦), talentos (Additional Lore), livres; export `lores: [["Nome", bônusSemNível]]` | 🧪 |
| INT aumentando depois do 1: uma perícia treinada e um idioma a mais por ponto | ✅ Player Core pg. 29 (Leveling Up) |

## 5. Pontos de vida, velocidade, tamanho

| Regra | Status |
| --- | --- |
| PV máximo = PV da ancestralidade + (PV da classe + CON) × nível + bônus | ✅ Player Core pg. 91 |
| Export: `attributes.ancestryhp`, `classhp`, `bonushp`, `bonushpPerLevel` (Toughness etc.) | 🧪 |
| Velocidade = da ancestralidade + bônus (`speedBonus`) − penalidade de armadura se FOR insuficiente | 🔎 |
| Tamanho da ancestralidade (`size`: 0 minúsculo … 5 colossal; `sizeName`) | 🧪 (Ardagar `size: 3`, Large) |
| Sentidos (visão na penumbra/escuro, faro) da ancestralidade/herança/talento → `specials` | 🧪 ("Scent (imprecise) 30 feet") |

## 6. Defesas

| Regra | Status |
| --- | --- |
| CA = 10 + DES (limitada pelo teto da armadura) + proficiência da categoria vestida + item (armadura + runa de potência) | ✅ Player Core pg. 271 / 🧪 (`acTotal`: `acProfBonus`, `acAbilityBonus`, `acItemBonus`, `acTotal`) |
| Escudo: o export **não** soma o escudo na CA (`shieldBonus: null`); a Ficha soma ao erguer | 🧪 + regra da Ficha |
| Salvaguardas = proficiência + atributo (FORT CON, REF DES, VON SAB) + item (runa resiliente → `mods`) | ✅ Player Core pg. 26 / 🧪 (`mods.Fortitude["Item Bonus"]`) |
| Percepção = proficiência + SAB + item | ✅ Player Core pg. 25 |
| CD de classe = 10 + proficiência + atributo-chave; as 29 classes Remaster começam treinadas | ✅ Player Core pg. 27 e o bloco "Class DC" de cada classe na AON |
| Resistências/fraquezas de ancestralidade, herança, item, talento → `resistances: ["poison 4"]` | 🧪 + 📦 |
| Penalidade de teste e de velocidade da armadura, traços (Bulwark, Flexible, Noisy) | 📦 / 🔎 |

## 7. Ataques (armas e desarmados)

| Regra | Status |
| --- | --- |
| Ataque = proficiência da categoria (ou específica) + atributo + potência | 🔎 / 🧪 (`weapons[].attack`) |
| Atributo: FOR corpo a corpo; DES à distância; acuidade = o maior; arremesso usa DES no ataque | 🔎 |
| Dados = 1 + striking (striking 2, greater 3, major 4) | 🔎 |
| Bônus de dano: FOR em corpo a corpo e arremesso; propulsivo = metade da FOR positiva | 🔎 |
| Especialização em armas (+2/+3/+4 por perito/mestre/lendário) e maior (dobra) | 🔎 (características de classe; o motor lê a característica, não a classe) |
| Export: `die`, `pot`, `str` (`""`, `"striking"`, `"greaterStriking"`, `"majorStriking"`), `runes`, `mat`, `display`, `damageType`, `attack`, `damageBonus`, `extraDamage`, `increasedDice` | 🧪 (ver CONTRATO-FICHA) |
| **Desarmados**: punho (1d4, ágil, acuidade, não letal) + ataques da ancestralidade/herança/talento/classe (`Strike` do Foundry) exportados em `weapons[]` | 🔎 + 📦 — corrige a lacuna do Pathbuilder (`unarmed.ts`) |
| Overrides manuais (ataque, dano, proficiência) entram como estão, com aviso `WEAPON_OVERRIDE` | — |

## 8. Conjuração

| Regra | Status |
| --- | --- |
| Tipo: preparado / espontâneo / inato / foco; tradição e atributo da classe ou da fonte | 📦 |
| **Slots por rank e nível**: tabela por progressão (conjurador pleno, Magus/Summoner, arquétipo Basic/Expert/Master Spellcasting) | 📦 tabelas curadas, 🔎 cada uma conferida na AON; 🧪 (`perDay` do elenco: Psíquico 10 `[3,2,2,2,2,2,…]`, Magus 7 `[6,2,2,2,1,…]`) |
| Truques por dia/conhecidos | 📦 |
| Repertório (espontâneo), assinatura, grimório (preparado de livro), preparadas do dia (cópias) | — |
| Proficiência de conjuração por tradição (`castingArcane`…) e conjurador (`spellCasters[].proficiency`) | 🧪 |
| CD de magia = 10 + proficiência + atributo; ataque = proficiência + atributo | 🔎 |
| **Pool de foco (Remaster)** = número de magias de foco (não truques), até 3 | 🔎 Player Core pg. 298 (já citado em `fixFocusPool`) |
| Magias concedidas (escola do Mago, domínio do Clérigo, fonte divina, mistério do Oráculo, consciência do Psíquico) | 📦 |
| Inatos de ancestralidade/herança/talento/item (Aiuvarin, Caster Arcane Sense, Advanced Targeting System, Pinch Time) | 📦 |
| Mythic Magic: bloco espontâneo próprio (`Mythic Magic`) | 🧪 (Ceros, Nathaniel) / 🔎 War of Immortals |
| Rituais (`rituals: [nome]`) | 🧪 |

## 9. Talentos e slots

| Regra | Status |
| --- | --- |
| Níveis de talento por classe (`featLevels`: ancestralidade, classe, geral, perícia) | 📦 (Foundry `classFeatLevels` etc.) / 🧪 (elenco: perícia 2,4,…; geral 3,7; ancestralidade 1,5,9) |
| Free Archetype: talento de arquétipo nos níveis pares | 🧪 (2,4,6,8,10) / 🔎 GM Core |
| Mítico: talento mítico nos níveis pares | 🧪 (2,4,6,8,10) / 🔎 War of Immortals |
| Ancestral Paragon: talentos de ancestralidade extras | 🧪 (slot "Ancestral Paragon Feat" no nível 3 no elenco) / 🔎 GM Core para a lista completa de níveis |
| Classes com talentos extras (Ladino: perícia a cada nível; Investigador: Skill Lessons; Guerreiro: Combat Flexibility) | 📦 / 🧪 |
| Talento concedido ("Awarded Feat"): Shield Block do Guerreiro, talento de perícia do background | 📦 / 🧪 |
| Escolhas aninhadas (`parentChoice`/`childChoice`): General Training, Natural Ambition, Reincarnation Feat, Basic Thoughtform… | 📦 (`GrantItem` + `ChoiceSet`) / 🧪 |
| Pré-requisitos (§11), raridade liberada, nível ≤ nível do slot | — |
| Dedicação: não pegar outra antes de 2 talentos do arquétipo atual (aviso `DEDICATION_LOCK`); talento de arquétipo ocupa slot de classe | ✅ Player Core pg. 215 |
| Talento repetível (`maxTakable`) e com qualificador | 📦 |

## 10. Rule elements suportados

O catálogo (FONTES-DE-DADOS) traz `rules` no formato do sistema PF2e do Foundry. O motor implementa um subconjunto; o
resto entra em `unsupported` e vira aviso **"efeito não calculado"** na ficha (nunca silêncio).

| Chave | Uso no Criador | Fase |
| --- | --- | --- |
| `ChoiceSet` | Abre um slot de escolha (perícia, grupo de arma, talento filtrado, tipo de dano) | 4 |
| `GrantItem` | Concede talento/característica/magia (com ou sem escolha) | 4 |
| `ActiveEffectLike` (proficiência, idiomas, sentidos, velocidade) | Ranks e outras mudanças "fixas" | 4 |
| `MartialProficiency` | Proficiência por grupo/categoria (Weapon Mastery) | 4 |
| `FlatModifier` com `selector` de PV/velocidade/perícia e tipo `item`/`untyped` **sem predicado** | Toughness, bônus permanentes | 4 |
| `BaseSpeed`, `Sense`, `Resistance`, `Weakness`, `Immunity` | Derivados | 4 |
| `Strike` | Desarmados de ancestralidade/talento | 6 |
| `CriticalSpecialization` | Marca a especialização crítica (a Ficha usa) | 6 |
| `AdjustStrike`, `AdjustDegreeOfSuccess`, `RollOption`, `Note`, `DamageDice` **com predicado** | Situacional → **não** entra no compilado (a Ficha trata em combate); listado como informação | — |
| Qualquer outro | `unsupported` → aviso | — |

**Predicados**: só os avaliáveis na criação (nível, rank, classe, ancestralidade, talento possuído) são resolvidos;
predicado de combate (`target:…`, `self:condition:…`) = situacional.

## 11. Pré-requisitos

O texto vem da AON/Foundry ("trained in Athletics; Power Attack"). O parser cobre os padrões mais comuns e devolve,
para cada parte, `ok | fail | unknown`:

| Padrão | Exemplo |
| --- | --- |
| Rank em perícia/estatística | "trained in Athletics", "expert in Perception", "master in a skill with the Recall Knowledge action" (este = unknown) |
| Talento possuído | "Power Attack", "Reactive Strike" |
| Característica de classe | "spellcasting class feature", "rage" |
| Atributo | "Strength +2" |
| Ancestralidade/herança/traço | "elf", "dwarf heritage" |
| Divindade/santificação | "you follow a deity", "holy" |
| Dedicação | "Wizard Dedication" |
| Alternativas "or" e listas ";" | — |

`unknown` = aviso amarelo "confira o pré-requisito" (não reprova). A lista de padrões cresce com casos no
`check-builder` (cada pré-requisito real que falhar no parser vira caso).

## 12. Equipamento, carga e dinheiro

| Regra | Status |
| --- | --- |
| Volume: L = 1/10; moedas 1000 = 1; contêineres reduzem (`ignored`) | 🔎 Player Core, "Bulk" |
| Sobrecarregado acima de 5 + FOR; máximo 10 + FOR | 🔎 / visto no Pathbuilder ("Enc: 8; Max: 13" com FOR +3) |
| Investidos: limite 10 (aviso `INVESTED_LIMIT`) | 🔎 |
| Runas: slots de propriedade = potência; striking/resiliente por grau; a maior troca a menor da mesma família | 🔎 GM Core, "Runes" |
| Materiais (graus, nível mínimo, preço) | 📦 / 🔎 |
| Preço com runas e material (para "comprar") | 📦 / 🔎 |
| Riqueza inicial (nível 1: 15 po; nível N: tabela "Character Wealth" do GM Core) | 🔎 (D6) |
| Automatic Bonus Progression: potência/striking/resiliente/perícia/percepção pelo nível, runas fundamentais saem do preço | 🔎 GM Core (variante) |

## 13. Companheiros

| Regra | Status |
| --- | --- |
| Companheiro animal: tipo (📦), jovem → maduro → incrível (+ especialização) pelos talentos | 📦 / a Ficha calcula os números (`companionStats.ts`) |
| Familiar: número de habilidades por talentos/classe | 📦 / 🔎 |
| Export: `pets[]` e `familiars[]` | 🧪 |

## 14. Variantes

Mapa completo (todas as regras opcionais, com fonte e fase): [REGRAS-OPCIONAIS.md](REGRAS-OPCIONAIS.md). Resumo do que o motor faz:

| Variante | O que muda no motor | Status |
| --- | --- | --- |
| Free Archetype | Slot `archetype-feat-N` nos níveis pares, filtrado a talentos com traço Archetype | ✅ GM Core pg. 84 / 🧪 |
| Mítico | Slot `mythic-feat-N` nos pares (destino obrigatório no 12º); proficiência mítica é da Ficha; Mythic Magic como conjurador | ✅ War of Immortals pg. 77 / 🧪 |
| Ancestry Paragon | Dois talentos de ancestralidade no 1º e um em cada ímpar (11 no total); o elenco usa o TALENTO geral Ancestral Paragon, não a variante | ✅ Gamemastery Guide pg. 194 (legado) |
| ABP | Ver §12 | 🔎 |
| PwL | Bônus de proficiência sem nível; a Ficha precisa saber (aviso até lá) | 🔎 |
| Dual Class | Segunda classe: `dualClass` no export, slots e proficiências das duas | 🔎 |

## 15. Avisos (catálogo inicial)

| Código | Quando |
| --- | --- |
| `PENDING_CHOICE` | Slot sem escolha até o nível atual |
| `PREREQ_FAIL` / `PREREQ_UNKNOWN` | Pré-requisito reprovado / não entendido |
| `RARITY_NOT_ALLOWED` | Incomum/raro sem liberação da mesa |
| `SOURCE_NOT_ALLOWED` / `LEGACY_CONTENT` | Livro não liberado / conteúdo pré-Remaster |
| `LEVEL_TOO_LOW` | Talento/item acima do nível do slot |
| `DEDICATION_LOCK` | Segunda dedicação cedo |
| `DUPLICATE_FEAT` | Talento não repetível escolhido duas vezes |
| `ATTR_OVERRIDE`, `WEAPON_OVERRIDE` | Valor manual |
| `SKILL_RANK_CAP` | Mestre antes do 7 / lendário antes do 15 |
| `INVESTED_LIMIT`, `ENCUMBERED`, `NEGATIVE_MONEY` | Inventário |
| `UNSUPPORTED_EFFECT` | Rule element não calculado |
| `ORPHAN_CHOICE` | Escolha cujo slot sumiu |
| `RULES_CHANGED` | Recompilar com catálogo novo mudou números |
