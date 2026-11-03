# Transformação (`/transformation`, `src/modules/transformation-statblock/`)

Gerador de stat block de battle forms, para qualquer personagem (não só conjurador).

- **Todas as battle forms do Remaster** em `data/` (um arquivo por magia, agregadas em `data/spells.ts`). Magia nova: criar
  `data/<x>.ts` (exporta `<x>Spell` + `<x>Forms`), registrar em `spells.ts` (imports, re-export, `transformationSpells`) e a
  progressão em `components/StatBlockGenerator.tsx` (`spellProgression[<id>]`).
- Dados do personagem do JSON Pathbuilder via `data/from-pathbuilder.ts`. Proficiência no Pathbuilder é `2×rank`; o
  modificador só soma o nível quando proficiente (`profMod`).
- **RAW**: CA = base da magia + nível; ataque/Atletismo = `max(magia, personagem)`; salvaguardas, Percepção e PV são os reais.
  Battle form não altera atributos nem dá ataque/CD de magia. **Ooze Form tem CA baixa de propósito** (`7 + nível`).
- **Tradução**: campos mecânicos em `data/` (tamanho, tipos de dano, traits, sentidos, imunidades, nomes de magia/forma/ataque)
  ficam **canônicos em inglês** e `i18n.ts` traduz no render; **nomes e descrições de habilidades ficam em pt-BR** nos `data/`.
  Siga esse split. As funções `translateX` de `i18n.ts` também servem a outros módulos (vocabulário de criatura).
- `StatBlockGenerator` é o subtree que o `html2canvas` captura: **hex literal**, envolvido por `LightTheme`. Ao mexer, acompanhe
  a folha de impressão escrita à mão em `ExportOptions.tsx` (replica classes do MUI e desanda em silêncio). O `jspdf` é usado aqui.
- `form.description` e `spell.description/heightened` não são exibidos.
