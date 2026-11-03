# Tema (`src/theme/`)

Identidade da linha **Remaster**: verde profundo, bege pergaminho e ouro/latão — não o vermelho do Pathfinder antigo.
**Moldura verde** (sidebar, barra de abas, cabeçalhos de seção com filete dourado) e **conteúdo em pergaminho** com tinta
escura. Títulos em Cinzel, corpo em Source Sans 3 (um `<link>` no `index.html`).

- `palette.ts`: tokens (`green`, `parchment`, `gold`, `ink`, `rule`, `greenInk`, `onFrame`, `onSolid`, `chrome`, `status`, `fx`)
  e mapas semânticos (tradições, proficiência, moedas, PV, tipo de item, raridade, `TROPHY_TIERS`). `index.ts` monta o tema
  do MUI (`buildTheme` a partir de um `ThemeCore`; `primary` = `greenInk`). **Componente não declara hex próprio.**
- **Hex de 6 dígitos sempre**; nada de `oklch`/`color-mix`/caminho de tema em string (ver raiz).
- **Contraste**: tinta do conteúdo sobre `parchment.paper` ≥ 4,5:1 (3:1 sobre `page`/`sunken`). Por isso `gold.main`
  (#A8842C) só entra em filete e borda; texto dourado é `gold.deep`.
- **Sem override global de `MuiDrawer`**: a gaveta de navegação é moldura, o `DescriptionDrawer` é conteúdo.
- `StatBlockGenerator.tsx` e `MonsterStatBlock.tsx` mantêm hex literal de propósito (subtree do `html2canvas`).

## Claro / Escuro / Sistema (`mode.ts`)

- O escuro é "pergaminho à luz de vela": a mesma moldura verde, conteúdo marrom quente, tinta e acentos clareados.
- **Constante do boot**: `setThemePref` recarrega. Escolha do **aparelho** (`pf2e:theme`, sem `mesaKey`), padrão "Sistema".
  O `index.html` repete a leitura num script inline (fundo e `theme-color`) — as duas cores de lá são cópias de `palette.ts`.
- `palette.ts` exporta os tokens da carga (`pick(claro, escuro)`). **O claro é idêntico ao de antes** (regra da casa).
- **Moldura × conteúdo — a regra que mais quebra**:
  - Trocam de tema: `parchment`, `ink`, `rule`, `gold.deep`, `status`, `greenInk`, acentos semânticos (`HP_COLOR`,
    `RAGE_COLOR`, `TRADITION_COLORS`, `RANK_COLORS`…).
  - Ficam iguais: `green.*`, `chrome.*`, `gold.main`/`bright`, `mapChrome`, `TOKEN_*`, `MAP_BACKDROP`, `DRAW_COLORS`, `medal`.
  - Texto sobre a moldura → `onFrame.*`/`chrome.*`, **nunca `parchment.*`** (some no escuro).
  - Verde como tinta, borda, ícone ou barra sobre o conteúdo → `greenInk.*`; `green.*` só como fundo de moldura.
  - Texto sobre acento cheio (chip "Em fúria", "Beber") → `onSolid`, não `'#FFFFFF'`. Hover de botão cheio: `HP_HOVER`, `WARNING_HOVER`.
  - Botão `contained` com fundo de moldura no `sx` precisa de `color: onFrame.paper`.
- Stat blocks exportados ficam **claros nos dois temas** (`components/LightTheme.tsx` em volta do `MonsterStatBlock` e do `StatBlockGenerator`).
- `scripts/check-contrast.mjs` confere os dois temas (`PF2E_THEME`). Pares baixos herdados do claro ficam em `LIGHT_KNOWN`.
  **Cor nova = as duas versões + o script passando.**
- Conferir sem login: modo local (ver raiz) com `localStorage['pf2e:theme']`.
