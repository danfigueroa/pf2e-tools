# CLAUDE.md

Orientações para o Claude Code trabalhar neste repositório. Para detalhes de produto, veja o `README.md`.

## O que é

**PF2e Toolkit** — SPA (React 19 + TypeScript + Vite + MUI 7) com ferramentas para Pathfinder 2e
Remaster. Textos de UI em **português (pt-BR)**.

Três módulos (rotas em `src/App.tsx`):
- `/ficha-virtual` → `src/modules/character-viewer/` — visualizador de ficha (JSON Pathbuilder) com
  descrições da AON traduzidas sob demanda.
- `/character-sheet` → `src/modules/character-sheet/` — geração de ficha em PDF (jsPDF).
- `/transformation` → `src/modules/transformation-statblock/` — gerador de stat block de battle forms.

## Comandos

```bash
npm run dev        # Vite dev server (Vite escolhe a porta, ~5173)
npm run dev:api    # servidor de scraping/tradução da AON (server/index.mjs, porta 3001)
npm run dev:full   # ambos (concurrently)
npm run build      # tsc -b && vite build  ← rode antes de considerar algo pronto
npm run lint       # eslint
```

Sempre valide mudanças não triviais com `npm run build` (roda `tsc -b`) e `npm run lint`.

## Backend

Dois modos servindo os mesmos endpoints de consulta à AON:
- `api/*.js` — funções serverless (deploy Vercel).
- `server/index.mjs` — mesmo backend para dev local.
- Núcleo compartilhado: `api/_lib/aon.js` (scraping com cheerio + tradução via Groq).
- Requer `GROQ_API_KEY` no `.env` (tradução das descrições da AON).
- Endpoints: `feat`, `search`, `spell`, `companion`, `health`, `clear-cache`, mais as variantes
  plurais (`feats`, `searches`, `spells`, `companions`) para busca em lote. Cliente no frontend:
  `src/services/descriptions.ts` (com cache).

## Convenções

- Um módulo por funcionalidade em `src/modules/`. Padrão: `*Page.tsx` (UI/estado), lógica em
  arquivos próprios, tipos em `types.ts`/`src/types/index.ts`.
- Tipos globais em `src/types/index.ts`. Tipos do formato Pathbuilder e `parseCharacterJson` em
  `src/modules/character-sheet/types.ts` (reutilizados por outros módulos).
- Helpers reutilizáveis do viewer: `src/modules/character-viewer/helpers.ts` (`abilityMod`, `totalHp`, …).
- Fichas de exemplo (formato Pathbuilder, campo `build`) em `public/characters/*.json`; presets em
  `src/modules/character-viewer/campaignPresets.ts`.

## Módulo character-viewer (Ficha Virtual)

- Visualizador interativo em `/ficha-virtual`. Reusa `parseCharacterJson`/`BuildInfo` do
  `character-sheet`. Layout: **abas no desktop, acordeões no mobile**; áreas em `sections/*`
  (Overview, Combat, Skills, Feats, Specials, Spells, Pets, Inventory) — as vazias somem sozinhas.
- **Guia "Como Jogar"** (Visão Geral): `combatGuides.ts`. Cada guia casa **por nome** da ficha
  (`byName`) e é escrito à mão (`curated: true`); sem guia catalogado, `buildFallbackGuide()` gera
  um resumo heurístico (marcado como automático). Guias curados **sem IA** — ver memória.
- **Ao adicionar uma ficha nova**: (1) copiar o JSON para `public/characters/`; (2) registrar em
  `campaignPresets.ts`; (3) escrever um guia curado em `combatGuides.ts` casando pelo nome.
- Descrições da AON são buscadas **sob demanda** ao tocar num item (`DescriptionDrawer` →
  `services/descriptions.ts`); a última ficha fica em `sessionStorage`.

## Módulo transformation-statblock (contexto que se perde fácil)

- **Todas as battle forms do Remaster** estão em `data/` (1 arquivo por magia, agregadas em
  `data/spells.ts`). Ao adicionar uma magia: criar `data/<x>.ts` (exporta `<x>Spell` + `<x>Forms`),
  registrar em `spells.ts` (imports, re-export, `transformationSpells`) e adicionar a progressão de
  stats em `components/StatBlockGenerator.tsx` (`spellProgression[<id>]`).
- **Dados reais do personagem** vêm do JSON Pathbuilder via `data/from-pathbuilder.ts`. As
  proficiências no Pathbuilder são o bônus `2×rank` (0/2/4/6/8); o modificador só soma o nível quando
  proficiente (rank>0) — ver `profMod`.
- **Regras (RAW)**: AC = base da magia + nível; ataque/atletismo = `max(magia, personagem)`;
  saves/percepção/PV são os reais do personagem (não mudam). Battle forms não alteram atributos nem
  dão ataque/DC de magia. Ooze Form tem CA baixa de propósito (`7 + nível`).
- **Tradução (pt-BR)**: `i18n.ts` traduz o vocabulário mecânico **no render** — por isso os campos
  mecânicos em `data/` (tamanho, tipos de dano nas strings de ataque, traits, sentidos, imunidades,
  nomes de magia/forma/ataque) ficam **canônicos em inglês**. Já **nomes e descrições de habilidades**
  são armazenados **em pt-BR** nos `data/`. Ao adicionar formas/habilidades novas, siga esse split.
- O bloco exibido (`StatBlockGenerator`) é o mesmo que a exportação captura via `html2canvas`;
  `form.description` e `spell.description/heightened` não são exibidos.

## Git

- Commits recentes vão direto na `main` (sem PR). Mensagens em português.
- Não faça `git push` sem o usuário pedir.
