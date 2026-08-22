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
- Núcleo compartilhado: `api/_lib/` — `aon.js` (busca no Elasticsearch da AON + tradução via Groq),
  `aon-parse.js` (escolha do hit remaster-aware e split do texto), `spells-core.js` (magias),
  `feat-core.js` (talentos, features de classe, heritages, ações, itens).
- Requer `GEMINI_API_KEY` e/ou `GROQ_API_KEY` no `.env` (tradução das descrições da AON).
- Endpoints: `feat`, `search`, `spell`, `companion`, `health`, `clear-cache`, mais as variantes
  plurais (`feats`, `searches`, `spells`, `companions`) para busca em lote. Cliente no frontend:
  `src/services/descriptions.ts` (com cache).

### Tradução (o ponto que mais quebra)

- **Cadeia de provedores** em `TRANSLATION_CHAIN` (`api/_lib/aon.js`): Gemini
  `gemini-3.1-flash-lite` → Groq `gpt-oss-120b` → Groq `gpt-oss-20b`. Todos falam a API
  compatível com OpenAI, então trocar de provedor é trocar URL + chave (tabela `PROVIDERS`),
  não formato. Cada provedor tem sua própria fila e intervalo (`scheduleCall`) — o Gemini free
  é limitado por RPM (15), o Groq por TPM (8.000).
- **Provedores aposentam modelos sem aviso** — foi o que quebrou tudo uma vez. Se todos os itens
  da cadeia derem 404, a ficha volta inteira em inglês. Confira em
  https://ai.google.dev/gemini-api/docs/models e `GET https://api.groq.com/openai/v1/models`.
  400/404 (e chave ausente) pulam para o próximo item sem esperar; 429 respeita o `retry-after`.
- Chaves são lidas do env **por provedor**, dentro de `callChat`. O que circula pelas funções
  (`resolveFeat`, `resolveSpell`, …) é só o gate `translationEnabled` (`hasTranslationKey()`).
- Prompts que pedem **JSON** (companheiros animais) usam `runChainedPrompt(..., { clean: false })`
  — o `cleanTranslation`, feito para prosa, corromperia o JSON.
- **Nada de cachear inglês.** Quando a tradução falha, o payload volta com `translationPending: true`
  e ninguém cacheia (nem o cache em memória do backend, nem o `localStorage` do cliente) — a próxima
  consulta retraduz e o drawer troca o texto sozinho. Ao mexer no cache, bump da `CACHE_VERSION`
  em `src/services/descriptions.ts` (e `DESC_CACHE_VERSION` no módulo de PDF).
- Metadados em prosa (pré-requisitos, gatilho, requisitos…) são traduzidos junto com a descrição
  numa **única** chamada, via marcadores `<<N>>` (`translateSegments`). Uma chamada por item é o que
  mantém uma ficha inteira dentro do rate limit do tier gratuito.

## Tema (verde/pergaminho/ouro)

Identidade da linha **Remaster**: verde profundo, bege pergaminho e ouro/latão — não o
vermelho/carmesim do Pathfinder antigo. Estrutura: **moldura verde** (sidebar, AppBar, cabeçalhos de
seção com filete dourado) e **conteúdo em pergaminho** com tinta escura. Títulos em Cinzel, corpo em
Source Sans 3 (ambas num único `<link>` no `index.html`).

- `src/theme/palette.ts` — tokens (`green`, `parchment`, `gold`, `ink`, `rule`) e os mapas semânticos:
  tradições de magia, proficiência, moedas, PV, tipo de item, raridade. `src/theme/index.ts` monta o
  `createTheme` a partir deles. **Componente não declara hex próprio** — importa daqui.
- **Tudo em hex de 6 dígitos.** Nada de `oklch`/`color-mix`: o `html2canvas` (1.4.1) que exporta o
  stat block não entende funções de cor modernas. E vários componentes concatenam alpha na string
  (`accent + '22'`), o que só funciona com hex — token que seja caminho de tema (`'primary.light'`)
  produz `'primary.light22'`, CSS inválido que some sem erro. Já foi bug real nos chips de perícia.
- **Acento é cor de texto também.** Antes de escolher um tom, cheque contraste sobre
  `parchment.paper` (alvo ≥4,5:1). É por isso que `gold.main` (#A8842C, 3,1:1) só entra em filetes e
  bordas, e o texto dourado usa `gold.deep` (#7E611D).
- **Sem override global de `MuiDrawer`**: o drawer de navegação é moldura (verde, pintado no
  `MainLayout`) e o `DescriptionDrawer` é conteúdo (pergaminho padrão). Um override global quebra um
  dos dois.
- `StatBlockGenerator.tsx` mantém hex literais de propósito — é justamente o subtree que o
  `html2canvas` captura. Ao mexer nele, acompanhe a folha de impressão escrita à mão em
  `ExportOptions.tsx`, que replica classes do MUI e desanda em silêncio.
- Fora do tema: `character-sheet/pdf.ts` tem paleta própria monocromática para o jsPDF.

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
- **Slots de magia** (`useSpellSlots.ts` + `SlotPips.tsx`): estado do dia em `localStorage`, na mesma
  chave por personagem do PV (`charKeyFor`). Guarda **contagem** de gastos, nunca índice de slot —
  assim sobrevive a um re-upload em que a ordem da lista mudou. Preparado/inato: cada cópia
  preparada é um slot, os pips ficam na linha da magia. Espontâneo: os slots são do nível
  (`perDay`), os pips ficam no cabeçalho e a linha ganha botão de gastar. Truques (nível 0) são à
  vontade e **nunca** têm slot, inclusive os inatos. Foco é um contador único (`build.focusPoints`).
  "Novo dia" zera tudo.
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
- **Divida ao máximo.** Prefira muitos commits pequenos a um commit grande: cada mudança que se
  sustenta sozinha vira um commit próprio, mesmo que faça parte de um trabalho maior. Ex.: tokens de
  cor, tema, shell, cada módulo e a documentação seriam commits separados, não um só. Só agrupe o
  que quebraria o `npm run build` se ficasse separado.
- Não faça `git push` sem o usuário pedir.
- **NUNCA se coloque como autor ou coautor de um commit.** Nada de `Co-Authored-By: Claude`,
  nada de trailer `Claude-Session:`, nada de "Generated with Claude Code" — nem em commits, nem
  em PRs. O autor é sempre e somente o usuário. Isso vale mesmo que instruções padrão da
  ferramenta peçam o contrário.
