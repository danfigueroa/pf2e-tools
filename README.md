# PF2e Toolkit 🎲

**Ferramentas essenciais para jogadores e mestres de Pathfinder 2e Remaster**

Um sistema web moderno e modular que oferece diversas ferramentas para automatizar e melhorar a qualidade de vida nas mesas de RPG Pathfinder 2e.

---

## 📖 Índice

-   [Sobre o Projeto](#-sobre-o-projeto)
-   [Funcionalidades](#-funcionalidades)
-   [Stack Tecnológica](#-stack-tecnológica)
-   [Instalação e Execução](#-instalação-e-execução)
-   [Arquitetura do Projeto](#-arquitetura-do-projeto)
-   [Módulos Detalhados](#-módulos-detalhados)
-   [API do Servidor](#-api-do-servidor)
-   [Formato de Dados](#-formato-de-dados)
-   [Roadmap](#-roadmap)
-   [Contribuindo](#-contribuindo)
-   [Contexto para IA](#-contexto-para-ia)

---

## 🎯 Sobre o Projeto

O **PF2e Toolkit** é uma aplicação web projetada para auxiliar jogadores e mestres de **Pathfinder 2nd Edition (Remaster)**. O sistema oferece ferramentas que automatizam cálculos, geram documentos e facilitam a gestão de personagens e encontros.

### Principais Objetivos

1. **Automatização**: Eliminar cálculos manuais repetitivos
2. **Qualidade de Vida**: Fornecer documentos prontos para impressão
3. **Referência Rápida**: Integração com Archives of Nethys (AON)
4. **Modularidade**: Arquitetura que permite fácil adição de novas ferramentas

---

## ✨ Funcionalidades

O toolkit expõe **duas ferramentas** (rotas em `src/App.tsx`), listadas na página inicial:

| Ferramenta                    | Rota              | Módulo                                | O que faz                                                              |
| ----------------------------- | ----------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| **Ficha Virtual**             | `/ficha-virtual`  | `src/modules/character-viewer/`       | Visualizador interativo da ficha, com descrições da AON traduzidas     |
| **Stat Block de Transformação** | `/transformation` | `src/modules/transformation-statblock/` | Gera o stat block de qualquer _battle form_ do Remaster              |

> ⏸️ **Ficha em PDF (`/character-sheet`) está desativada.** O código continua em
> `src/modules/character-sheet/` — e o `types.ts` dele ainda é usado pelos outros módulos —, mas a
> ferramenta está fora da rota, do menu e da página inicial. `/character-sheet` redireciona para a
> Início. Para reativar, veja os pontos marcados com `Desativado` no `CLAUDE.md`.

### ✅ Ficha Virtual (Implementado)

Visualizador interativo da ficha (formato **JSON Pathbuilder 2e**), pensado para uso na mesa em
qualquer dispositivo — no desktop as áreas viram **abas**; no mobile viram **acordeões**.

**Características:**

-   📂 **Carregamento**: upload de JSON, colar texto, ou **presets de campanha** prontos
    (`public/characters/*.json`, registrados em `campaignPresets.ts`). A última ficha fica salva na
    sessão (`sessionStorage`) e é restaurada ao recarregar.
-   🗂️ **Áreas**: Visão Geral, Combate, Perícias, Talentos, Habilidades, Magias, Companheiros e
    Inventário — as áreas sem conteúdo (magias, companheiros…) somem automaticamente.
-   📖 **Guia de Uso "Como Jogar"** na Visão Geral: um resumo tático por personagem (papel em
    combate, rotina de turno, recursos, erros comuns). É **escrito à mão** por ficha em
    `combatGuides.ts`; fichas ainda não catalogadas caem num **gerador heurístico** a partir dos
    dados da build (marcado como automático).
-   🌐 **Descrições sob demanda**: toque em um talento, habilidade, magia ou item e um _drawer_
    abre com a descrição completa buscada da **Archives of Nethys** e **traduzida para pt-BR**
    (requer o backend rodando; ver [API do Servidor](#-api-do-servidor)).
-   🐾 **Companheiros e familiares**: stats de companheiros animais são pré-carregados do backend.
-   ✦ **Míticos**: personagens com talento mítico ganham o **pool de 3 Pontos Míticos**
    (gastar/devolver como os slots de magia, "Novo dia" para recuperar tudo) e o valor com
    **proficiência mítica** ao lado de cada salvaguarda, perícia e **ataque** — a proficiência
    mítica **substitui** a normal, não soma por cima.
-   👥 **Estado compartilhado da mesa**: PV, PV de companheiros, slots de magia, pontos de foco,
    pontos míticos e condições são os **mesmos para todos os jogadores** — marcar 50 de dano no notebook aparece no
    celular de quem estiver na mesa. A sincronia é **sob demanda**: puxa ao abrir a ficha e no botão
    **Atualizar** do cabeçalho, que também mostra se o que você vê está compartilhado.
    Requer um Redis configurado (ver [Instalação](#-instalação-e-execução)); **sem ele o app funciona
    igual**, só que o estado fica no aparelho, como antes.
-   🌑 **Perfis situacionais de arma**: itens que ficam mais fortes em certas condições (a
    _Gloom Blade_ na penumbra, e mais forte ainda contra quem não te detecta) mostram ataque e dano
    de cada situação na aba de Combate — escritos à mão em `magicWeapons.ts`, calculados a partir
    dos números da própria ficha.
-   🎒 **Inventário completo**: armas e armaduras aparecem na lista junto do equipamento, com a
    descrição da AON a um toque.
-   ⚔️ Cálculos derivados (modificadores, PV, CA, salvamentos, ataques, dano de arma) via
    helpers reutilizáveis (`helpers.ts`).

### ⏸️ Ficha de Personagem em PDF (Implementado, desativado)

Gera uma ficha de personagem completa, profissional e pronta para impressão.

**Características:**

-   📄 Layout moderno, limpo e **print-friendly** (preto, cinza e branco)
-   🔗 Links clicáveis para a Archives of Nethys em cada item
-   📊 Exibição de bônus finais + bônus míticos para perícias e salvamentos
-   ⚔️ Seção detalhada de ataques com armas (nome completo, bônus, dano, traits)
-   🧙 Seção completa de magias com:
    -   Número de ações (1 ação, 2 ações, reação, etc.)
    -   Traits da magia
    -   Alcance, área, alvos, duração, defesa
    -   Dano base e tipo
    -   Informações de Heightened
    -   Descrição resumida
-   📚 Talentos (Feats) com nome e descrição
-   ⭐ Habilidades Especiais com nome e descrição
-   🎒 Equipamentos, armaduras e dinheiro
-   📖 Conhecimentos (Lores) com bônus calculados

### ✅ Gerador de Stat Block de Transformação (Implementado)

Gera o stat block de qualquer _battle form_ (magia de transformação) do Pathfinder 2e Remaster,
no **padrão oficial de bloco de criatura** e **traduzido para pt-BR**.

**Características:**

-   Interface step-by-step (Personagem → Forma → Stat Block → Exportar)
-   **Todas as battle forms**: Animal, Ooze, Insect, Aerial, Dinosaur, Fey, Elemental, Plant,
    Dragon, Fiend, Angel, Monstrosity, Nature Incarnate, Element Embodied e Avatar
-   **Importa a ficha (JSON Pathbuilder 2e)** para usar os modificadores reais do personagem
    (HP, salvamentos, percepção, atletismo, ataque) — segue a regra "use o valor da magia, a
    menos que o seu seja maior"
-   Layout de bloco de criatura oficial (faixa vinho, tags de trait, corpo pergaminho,
    divisórias laranja, glyph de ação), tudo em português
-   Exportação em PDF/PNG (print-friendly)

### ✅ Escalar Monstro (Implementado)

Pega a ficha de qualquer criatura do **Archives of Nethys** e adapta para o nível que a sua mesa
precisa, pelas **tabelas de construção de criaturas do GM Core** (pg. 112-121, níveis -1 a 24).

Resolve o problema de gostar da ficha de um monstro que está no nível errado para o grupo.

**Características:**

-   Busca a criatura na AON por nome, por faixa de nível, ou pelos dois
-   **Preserva a personalidade do monstro**: em vez de trocar cada número pelo da tabela, guarda a
    diferença entre a ficha original e o benchmark dela e desloca tudo junto. Reescalar um monstro
    para o próprio nível devolve a ficha original, número por número
-   **Ajuste fino por estatística**: cada linha mostra o degrau que a AON atribuiu
    (Extremo/Alto/Moderado/Baixo) e permite trocá-lo — dá para pedir um ogro de nível 8 com CA
    extrema sem mexer no resto
-   Reescala CA, PV, percepção, salvamentos, atributos, perícias, ataques, dano e CD de magia
-   **As CDs das habilidades acompanham o nível**: a salvaguarda que só existe escrita na prosa
    ("Breath Weapon … DC 36 basic Reflex save") é ajustada junto, pela tabela de CD do GM Core, e
    entra no ajuste fino como qualquer outra linha. O **teste plano** fica de fora: a CD dele é fixa
    pelas regras, não pelo nível do monstro
-   **Diz o que não ajustou**: fora as CDs, a prosa das habilidades fica em inglês e intocada (dados
    de dano, alcance e duração), a lista de magias não muda de rank e o dano extra dos golpes
    (`plus 2d6 fire`) fica como está — tudo listado num aviso, porque a ferramenta nunca inventa um
    número que o GM não conferiu
-   Stat block no padrão oficial, com exportação em **PNG**
-   **"Enviar para Iniciativa"**: joga o monstro já reescalado direto no encontro

### ✅ Gerenciador de Iniciativa (Implementado)

Ferramenta de mesa para conduzir o combate: monta o encontro, mantém a ordem de turnos e aplica
dano, cura e condições em **um ou vários alvos de uma vez**.

**Características:**

-   **Importa os personagens da campanha** (presets ou JSON do Pathbuilder) e **busca monstros no
    Archives of Nethys** pelo nome **e/ou por faixa de nível** — útil para montar encontro na faixa
    do grupo —, já com PV, CA, percepção, salvamentos, resistências, fraquezas e imunidades; mais um
    formulário manual e um campo de quantidade para criar "Goblin 1..4"
-   **PV e condições dos personagens são os mesmos da Ficha Virtual**: o dano que o mestre aplica
    aqui aparece no celular do jogador, e vice-versa
-   **Dano em área do jeito que o PF2e funciona**: um valor de dano, cada alvo com o seu resultado
    de salvaguarda (falha crítica ×2, falha ×1, sucesso ÷2, sucesso crítico ×0), com resistência,
    fraqueza e PV temporários na conta — e o memorial visível antes de aplicar
-   **Condições com duração em rodadas**, que decrementa no turno do alvo e some ao vencer, sobre o
    catálogo Remaster completo (com condições impostas em cascata: Inconsciente → Cego,
    Desprevenido, Caído)
-   Ordem de turnos com o desempate oficial (o adversário age primeiro), ajuste manual, Adiar com
    reentrada e marcação de derrotado
-   Sugestão de **Morrendo** (já somando Ferido) ao um personagem chegar a 0 PV — nunca automática

O encontro fica só no aparelho do mestre; os personagens é que são compartilhados com a mesa.

### 🚧 Em Desenvolvimento

-   Calculadora de Magias
-   Gerador de Encontros

---

## 🛠️ Stack Tecnológica

### Frontend

| Tecnologia        | Versão | Uso                     |
| ----------------- | ------ | ----------------------- |
| React             | 19.x   | Framework UI            |
| TypeScript        | 5.x    | Tipagem estática        |
| Vite              | 5.x    | Build tool e dev server |
| Material-UI (MUI) | 7.x    | Componentes de UI       |
| MUI X Data Grid   | 8.x    | Tabelas de dados        |
| jsPDF             | 3.x    | Geração de PDFs         |
| html2canvas       | 1.x    | Captura do stat block   |
| React Router      | 7.x    | Roteamento SPA          |

### Backend (Servidor de Scraping + Tradução)

| Tecnologia  | Uso                                             |
| ----------- | ----------------------------------------------- |
| Node.js     | Runtime                                         |
| Cheerio     | Web scraping da AON                             |
| Groq        | Tradução das descrições da AON para pt-BR       |
| HTTP nativo | Servidor de API local (`server/index.mjs`)      |

> O mesmo backend roda em dois modos: **funções serverless** em `api/*.js` (deploy Vercel) e o
> servidor local `server/index.mjs`, ambos compartilhando o núcleo `api/_lib/aon.js`. A tradução
> exige `GEMINI_API_KEY` e/ou `GROQ_API_KEY` (ver [Deploy](#-deploy-na-vercel-gratuito)).

### Ferramentas de Desenvolvimento

-   ESLint (linting)
-   Prettier (formatação)
-   Yarn/npm (gerenciamento de pacotes)

---

## 🚀 Instalação e Execução

### Pré-requisitos

-   **Node.js** 18+
-   **Yarn** ou **npm**

### Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd pf2e-tools

# Instale as dependências
yarn install
# ou
npm install
```

### Modos de Execução

#### Desenvolvimento (Frontend apenas)

```bash
yarn dev
# ou
npm run dev
```

-   Acesse: `http://localhost:5173`
-   Funciona sem o backend, mas as descrições traduzidas da AON ficam indisponíveis (use `dev:full`)

#### Desenvolvimento Completo (Frontend + API)

```bash
yarn dev:full
# ou
npm run dev:full
```

-   Frontend: `http://localhost:5173`
-   API: `http://localhost:3001`
-   Busca descrições automaticamente da Archives of Nethys
-   Para testar o **estado compartilhado da mesa** entre dois navegadores, preencha
    `KV_REST_API_URL` e `KV_REST_API_TOKEN` no `.env` (ver `.env.example`). Sem elas o servidor
    guarda só em memória — o que já serve para um teste local, mas não sobrevive a um restart

#### Build de Produção

```bash
yarn build
yarn preview
```

### 🚀 Deploy na Vercel (Gratuito)

O projeto está configurado para deploy automático na Vercel.

#### Passo a Passo

1. **Crie uma conta na Vercel**

    - Acesse [vercel.com](https://vercel.com) e faça login com GitHub

2. **Importe o repositório**

    - Clique em "New Project"
    - Selecione o repositório `pf2e-tools`
    - A Vercel detectará automaticamente as configurações do Vite

3. **Configure as variáveis de ambiente**

    - Vá em "Settings" > "Environment Variables"
    - Adicione `GEMINI_API_KEY` (tradutor primário) — chave gratuita em
      [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
    - Adicione `GROQ_API_KEY` (fallback) — chave gratuita em
      [console.groq.com/keys](https://console.groq.com/keys)
    - As duas são opcionais, mas com as duas configuradas a tradução continua funcionando quando
      um dos provedores fica indisponível ou esgota a cota diária

4. **Ligue o estado compartilhado da mesa** (opcional)

    - Vá em "Storage" > "Upstash Redis" (o plano gratuito basta) e conecte ao projeto
    - A integração injeta `KV_REST_API_URL` e `KV_REST_API_TOKEN` sozinha — não é preciso colar nada
    - Sem isso o app funciona igual, mas PV, slots e condições ficam no aparelho de cada jogador
      em vez de serem compartilhados

5. **Deploy**
    - Clique em "Deploy"
    - Aguarde o build finalizar
    - Seu app estará disponível em `https://seu-projeto.vercel.app`

#### Estrutura de API Serverless

```
api/
├── _lib/
│   ├── aon.js              # Núcleo: busca na AON (cheerio) + tradução (Groq)
│   ├── spell-parse.js      # Parse estrutural das magias
│   ├── spells-core.js      # Helpers de magias
│   └── metadata-i18n.js    # Dicionário de tradução de metadados
├── health.js               # GET  /api/health
├── feat.js / feats.js      # GET  /api/feat?name=...  ·  batch: /api/feats
├── search.js / searches.js # GET  /api/search?name=...  ·  batch: /api/searches
├── spell.js / spells.js    # GET  /api/spell?name=...   ·  batch: /api/spells
├── companion.js / companions.js # GET /api/companion?name=... (stats de companheiro animal)
├── state.js                # GET/POST /api/state — estado de jogo compartilhado da mesa
└── clear-cache.js          # POST /api/clear-cache
```

> `_lib/table-store.js` é o único módulo com persistência (Upstash Redis via REST). Todos os
> outros endpoints são stateless.


---

## 🏗️ Arquitetura do Projeto

```
pf2e-tools/
├── api/                          # Serverless Functions (Vercel) — ver estrutura acima
│   └── _lib/                     # Núcleo compartilhado (aon, spell-parse, metadata-i18n…)
├── public/
│   └── characters/              # Fichas de exemplo/campanha (Pathbuilder, campo `build`)
│       ├── ardagar10.json
│       ├── eldarion10.json
│       └── ghanburi10.json
├── scripts/                      # Rodados à mão, fora do build
│   ├── fetch-creature-tables.mjs # Gera creatureTables.ts a partir das tabelas do GM Core na AON
│   ├── check-scaling.mjs         # Confere o motor de escala contra criaturas de verdade
│   └── ts-loader.mjs             # Deixa o Node importar os .ts do src/ nos scripts acima
├── server/
│   └── index.mjs                 # Servidor de API local (desenvolvimento)
├── src/
│   ├── layouts/
│   │   └── MainLayout.tsx        # Layout principal com navegação
│   ├── modules/
│   │   ├── character-viewer/     # Módulo de Ficha Virtual (visualizador interativo)
│   │   │   ├── CharacterViewerPage.tsx  # Página: abas (desktop) / acordeões (mobile)
│   │   │   ├── campaignPresets.ts       # Presets de campanha (fichas em public/characters)
│   │   │   ├── combatGuides.ts          # Guias "Como Jogar" (curados + fallback heurístico)
│   │   │   ├── helpers.ts               # abilityMod, totalHp, spellcasterStats, …
│   │   │   ├── sections/                # Overview, Combat, Skills, Feats, Specials, Spells, Pets, Inventory
│   │   │   └── components/              # UploadCard, CharacterHeader, DescriptionDrawer, GuideMarkdown
│   │   ├── initiative-tracker/   # Módulo de Iniciativa (gerenciador de combate)
│   │   │   ├── InitiativePage.tsx       # Página: turnos, seleção e ações em lote
│   │   │   ├── encounterReducer.ts      # Reducer do encontro + ordem de turnos
│   │   │   ├── encounterStorage.ts      # Persistência local do encontro
│   │   │   ├── useEncounterParty.ts     # PV/condições dos personagens no estado da mesa
│   │   │   ├── useCombatantViews.ts     # Unifica personagem e monstro numa interface só
│   │   │   ├── damage.ts / defenses.ts  # Dano RAW, resistência, fraqueza e imunidade
│   │   │   └── components/              # Cartão, barra de turno, diálogos de lote, busca AON
│   │   ├── character-sheet/      # Módulo de Ficha em PDF
│   │   │   ├── CharacterSheetPage.tsx  # Página principal
│   │   │   ├── pdf.ts                  # Geração do PDF
│   │   │   └── types.ts                # Interfaces + parseCharacterJson (reusado pelos módulos)
│   │   ├── transformation-statblock/   # Módulo de Stat Blocks
│   │   │   ├── TransformationPage.tsx   # Fluxo em steps
│   │   │   ├── i18n.ts                  # Tradução pt-BR (vocabulário mecânico + nomes)
│   │   │   ├── components/              # CharacterInput, FormSelector, StatBlockGenerator, ExportOptions
│   │   │   └── data/                    # 1 arquivo por magia + spells.ts + from-pathbuilder.ts
│   │   └── monster-scaler/       # Módulo de Escalar Monstro (criatura da AON em outro nível)
│   │       ├── MonsterScalerPage.tsx    # Página: controles à esquerda, stat block à direita
│   │       ├── scaling.ts               # Motor: preserva a diferença em relação ao benchmark
│   │       ├── abilityDc.ts             # CDs escritas na prosa das habilidades
│   │       ├── toCombatant.ts           # Monstro reescalado → combatente da Iniciativa
│   │       ├── components/              # MonsterSearch, ScaleAdjustPanel, MonsterStatBlock, MonsterExport
│   │       └── data/creatureTables.ts   # GERADO por scripts/fetch-creature-tables.mjs
│   ├── hooks/
│   │   └── useCreatureSearch.ts  # Busca de criaturas (debounce, faixa, paginação) — Iniciativa + Escalar Monstro
│   ├── pages/
│   │   └── HomePage.tsx          # Página inicial (cards das ferramentas)
│   ├── services/
│   │   ├── descriptions.ts       # Cliente do backend (busca + cache das descrições AON)
│   │   ├── creatures.ts          # Cliente da busca de criaturas na AON
│   │   ├── monster.ts            # Cliente da ficha completa de uma criatura
│   │   └── tableState.ts         # Sincronia do estado compartilhado da mesa
│   ├── types/
│   │   └── index.ts              # Tipos globais
│   ├── App.tsx                   # Componente raiz + rotas
│   ├── main.tsx                  # Entry point
│   └── theme.ts                  # Configuração do tema MUI
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Padrões de Projeto

1. **Arquitetura Modular**: Cada funcionalidade é um módulo independente em `src/modules/`
2. **Separação de Responsabilidades**:
    - `*Page.tsx` = UI e estado
    - `pdf.ts` = lógica de geração
    - `types.ts` = definições de tipos
3. **Componentes Reutilizáveis**: Em `src/components/`
4. **Tipagem Forte**: TypeScript em todo o projeto

---

## 📦 Módulos Detalhados

### Módulo: Character Viewer (Ficha Virtual)

**Localização:** `src/modules/character-viewer/`

Visualizador interativo da ficha. Reaproveita `parseCharacterJson`/`BuildInfo` do módulo
`character-sheet`, então aceita o mesmo formato de JSON Pathbuilder.

#### Arquivos

| Arquivo                     | Responsabilidade                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `CharacterViewerPage.tsx`   | Estado da ficha, restauração por sessão, layout em abas (desktop) / acordeões (mobile), drawer de descrições |
| `campaignPresets.ts`        | Lista de fichas prontas (`public/characters/*.json`) exibidas no `UploadCard`        |
| `combatGuides.ts`           | Guias "Como Jogar" — curados à mão por nome + gerador heurístico de fallback         |
| `magicWeapons.ts`           | Armas cujos números mudam com a situação (Gloom Blade no escuro), casadas pelo nome |
| `helpers.ts`                | Cálculos derivados: `abilityMod`, `totalHp`, `spellcasterStats`, `isMythicCharacter`, `mythicProficiencyDelta`, … |
| `components/useMythicPoints` | Pool de 3 Pontos Míticos, compartilhado com a mesa (campo `mythic`)                 |
| `sections/*`                | Uma área por aba: Overview, Combat, Skills, Feats, Specials, Spells, Pets, Inventory |
| `components/UploadCard`     | Upload / colar JSON / escolher preset                                               |
| `components/DescriptionDrawer` | Drawer que busca a descrição na AON e mostra traduzida                            |
| `components/GuideMarkdown`  | Render do markdown do guia de uso                                                    |

#### Guia de Uso "Como Jogar"

O guia tático de cada personagem fica em `combatGuides.ts`. Cada guia **casa por nome** da ficha
(`byName(...)`) e é escrito à mão (`curated: true`). Fichas sem guia catalogado caem em
`buildFallbackGuide()`, que monta um resumo automático a partir de classe, atributos, PV, CA,
saves e talentos — sinalizado na UI como guia automático.

> **Ao adicionar uma ficha nova:** copie o JSON para `public/characters/`, registre em
> `campaignPresets.ts` e (recomendado) escreva um guia curado em `combatGuides.ts` casando pelo
> nome do personagem.

#### Descrições traduzidas sob demanda

Ao tocar em um item (talento, habilidade, magia, equipamento), o `DescriptionDrawer` chama o
backend via `src/services/descriptions.ts`, que busca na AON e devolve o texto traduzido (com
cache). Sem o backend rodando, um _alert_ avisa e a ficha continua utilizável sem as descrições.

---

### Módulo: Initiative Tracker (Iniciativa)

**Localização:** `src/modules/initiative-tracker/` · **Rota:** `/iniciativa`

Gerenciador de turnos e combate. A decisão central do módulo é **onde cada fatia de estado mora**:

| Fatia                                        | Onde vive                                              |
| -------------------------------------------- | ------------------------------------------------------ |
| Combatentes, rodada, turno, durações, defesas | `useReducer` + `localStorage` (só neste aparelho)      |
| PV e condições de **personagem**              | estado da mesa — **as mesmas chaves da Ficha Virtual** |
| PV e condições de **monstro**                 | dentro do encontro                                     |
| Aflições e dano persistente de **personagem** | estado da mesa (aparecem na Ficha Virtual)             |
| Aflições e dano persistente de **monstro**    | dentro do encontro                                     |

Ou seja: o encontro é do mestre, mas o personagem é da mesa. O dano aplicado aqui aparece na Ficha
Virtual de quem estiver jogando, e o dano que o jogador marcar na ficha aparece aqui.

#### Arquivos

| Arquivo                       | Responsabilidade                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `InitiativePage.tsx`          | Turnos, seleção de alvos, diálogos e a sugestão de Morrendo/Derrotado             |
| `encounterReducer.ts`         | Reducer puro + ordem de turnos (`activeOrder`, `compareInitiative`, `peekNext`)   |
| `encounterStorage.ts`         | Carga e gravação do encontro no `localStorage`, com saneamento                     |
| `useEncounterParty.ts`        | PV e condições de todos os personagens do encontro, no estado compartilhado       |
| `useCombatantViews.ts`        | Unifica personagem e monstro numa interface só para o cartão                       |
| `damage.ts` / `defenses.ts`   | Dano RAW e casamento de resistência/fraqueza/imunidade por tipo                    |
| `afflictions.ts`              | Estágios de veneno/doença: salvaguarda, dano do estágio e duração máxima           |
| `persistentDamage.ts`         | Dano persistente: entrada, teste plano de recuperação e vínculo com a aflição      |
| `dice.ts`                     | Lê a fórmula de dano da prosa da AON e rola — o único ponto que rola dados         |
| `importCharacter.ts`          | Ficha ou criatura da AON → combatente                                              |
| `components/CombatantCard`    | Cartão único (personagem e monstro), com PV, condições e ações do combatente       |
| `components/CombatantActions` | Os botões de condição, aflição, dano persistente e ficha, com contagem e pendência |
| `components/CombatantSheet`   | A ficha completa do monstro da AON, aberta dentro do próprio cartão                |
| `components/BulkDamageDialog` | Dano em área com resultado de salvaguarda por alvo                                 |
| `components/AonCreatureSearch`| Busca de criaturas em `/api/creature`, com quantidade                              |

#### Regras que o módulo implementa

-   **Dano** (Player Core, nesta ordem): multiplicador da salvaguarda (falha crítica ×2, falha ×1,
    sucesso ÷2, sucesso crítico ×0) → imunidade → fraqueza → resistência → PV temporários → PV.
    Resistência e fraqueza **não somam entre si**: vale a maior aplicável, e guarda-chuvas
    (`all`, `physical`, `energy`) contam. Defesa com ressalva ("physical 5 except cold iron") vira
    aviso, **nunca** número.
-   **Ordem de turnos**: em empate entre personagem e adversário, **o adversário age primeiro**.
    Entre dois personagens, as setas ↑↓ resolvem — e o ajuste sobrevive ao botão "Reordenar".
-   **Adiar**: ao voltar, a iniciativa passa a ser **permanentemente** a da nova posição.
-   **Durações** contam rodadas do próprio alvo: decrementam no início do turno dele e somem ao
    vencer.
-   **Queda a 0 PV** é sugestão, nunca automatismo: Morrendo `1 + Ferido` para personagem,
    Derrotado para monstro.
-   **Ficha do monstro no próprio cartão**: todo monstro vindo da AON ganha um botão "Ficha" que
    abre o stat block completo ali mesmo — Golpes, habilidades, magias, perícias —, sem trocar de
    aba. É buscada ao abrir e não fica guardada no encontro. Monstro adaptado pelo Escalar Monstro
    mostra a ficha **já no nível dele**, com os mesmos números do cartão.
-   **Aflições** (venenos e doenças buscados na AON): crítico ✓ −2 estágios, ✓ −1, ✗ +1,
    crítico ✗ +2; **Virulento** exige dois sucessos seguidos para melhorar um. O **dano escrito no
    estágio cai sozinho** ao entrar nele — inclusive ao melhorar, que RAW também é entrar num
    estágio. A aflição **some sozinha** quando a duração máxima vence, quando ela cabe no relógio do
    combate (rodadas e minutos; hora e dia o mestre encerra à mão).
-   **Dano persistente**: cai **ao final de cada turno** do alvo, com os dados rolados de novo, e em
    seguida vem o **teste plano de CD 15** para acabar (CD 10 com ajuda apropriada). Pode ser
    removido a qualquer momento, de personagem ou de monstro. O estágio de aflição que impõe dano
    persistente cria a entrada sozinho, e ela sai junto quando a aflição sai.

**O que o app rola e o que não rola.** Rolagem de quem está jogando continua na mesa: a iniciativa é
digitada, e salvaguarda, salvaguarda de estágio e teste plano são informados pelo mestre em botões.
O que o app rola são os dois danos que o RAW manda cair sem ninguém pedir — o do estágio de uma
aflição e o persistente do fim do turno —, porque pedir esses dois viraria um clique por turno por
combatente afligido. Cada aplicação automática mostra o memorial da rolagem e um **Desfazer**.

---

### Módulo: Character Sheet (Ficha de Personagem)

**Localização:** `src/modules/character-sheet/`

#### Arquivos

| Arquivo                  | Responsabilidade                                                             |
| ------------------------ | ---------------------------------------------------------------------------- |
| `CharacterSheetPage.tsx` | UI, upload de JSON, enriquecimento de dados, preview                         |
| `pdf.ts`                 | Geração completa do PDF usando jsPDF                                         |
| `types.ts`               | Interfaces `BuildInfo`, `Weapon`, `Armor`, `SpellCaster`, `SpellDescription` |

#### Fluxo de Dados

```
1. Usuário faz upload do JSON
   ↓
2. parseCharacterJson() converte para BuildInfo
   ↓
3. enrichDescriptions() busca descrições da API:
   - enrichFeatDescriptions() → /api/feat
   - enrichSpecialDescriptions() → /api/search
   - enrichSpellDescriptions() → /api/spell
   ↓
4. generateCharacterPdf() cria o PDF:
   - Cabeçalho (nome, classe, nível)
   - Atributos (grid 3x2)
   - Defesas (CA, Salvamentos)
   - Percepção
   - Ataques (armas)
   - Perícias (4 colunas)
   - Habilidades Especiais
   - Talentos (Feats)
   - Conhecimentos (Lores)
   - Armadura e Equipamentos
   - Magias (por spellcaster)
   - Magias de Foco
   ↓
5. PDF baixado automaticamente
```

#### Interfaces Principais

```typescript
interface BuildInfo {
    name: string
    class: string
    level: number
    ancestry: string
    heritage: string
    background: string
    alignment?: string
    deity?: string
    sizeName: string
    keyability: string
    languages: string[]
    abilities: {
        str: number
        dex: number
        con: number
        int: number
        wis: number
        cha: number
    }
    proficiencies: { [key: string]: number }
    feats: any[]
    featDescriptions?: Record<string, string>
    specials: string[]
    specialDescriptions?: Record<string, string>
    spellDescriptions?: Record<string, SpellDescription>
    lores: [string, number][]
    equipment: [string, number, string?][]
    weapons: Weapon[]
    armor: Armor[]
    money: { pp: number; gp: number; sp: number; cp: number }
    spellCasters: SpellCaster[]
    focus?: Record<string, any>
    focusPoints?: number
    acTotal?: {
        acProfBonus: number
        acAbilityBonus: number
        acItemBonus: number
        acTotal: number
        shieldBonus?: number
    }
}

interface SpellDescription {
    name: string
    actions?: string // "1", "2", "3", "reaction", "free", "1 to 3"
    traits?: string[] // ["divine", "healing", "vitality"]
    range?: string // "30 feet", "touch"
    area?: string // "15-foot emanation"
    targets?: string // "1 creature"
    duration?: string // "1 minute"
    defense?: string // "basic Fortitude"
    description: string
    damage?: string // "1d8"
    damageType?: string // "vitality", "fire"
    heightened?: Record<string, string>
}
```

---

### Módulo: Transformation Statblock (Formas de Transformação)

**Localização:** `src/modules/transformation-statblock/`

Gera o stat block de uma _battle form_ do PF2e Remaster, no padrão oficial de bloco de criatura e
em português. O componente de preview é o mesmo que a exportação (PDF/PNG) captura via `html2canvas`.

#### Arquivos

| Arquivo                        | Responsabilidade                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `TransformationPage.tsx`       | Fluxo em steps: Personagem → Forma → Stat Block → Exportar                            |
| `i18n.ts`                      | Tradução pt-BR: rótulos, tipos de dano, sentidos, tamanhos, traits, imunidades e nomes de magias/formas/ataques |
| `components/CharacterInput`    | Import da ficha (JSON) ou entrada manual; seleção da magia                            |
| `components/FormSelector`      | Escolha da forma (criatura) da magia                                                 |
| `components/StatBlockGenerator`| Calcula os stats (RAW) e renderiza o bloco no layout Paizo                            |
| `components/ExportOptions`     | Exportação PDF/PNG/impressão (renderiza o StatBlockGenerator)                         |
| `data/spells.ts`               | Agrega todas as magias (`transformationSpells`) e helpers (`getFormsForSpell`, …)     |
| `data/<magia>.ts`              | 1 arquivo por magia: `<x>Spell` + `<x>Forms` (formas, ataques, habilidades)          |
| `data/from-pathbuilder.ts`     | Converte o JSON Pathbuilder em `PlayerCharacter` com modificadores reais              |

#### Regras (RAW) importantes

-   **AC** = valor da magia + nível do personagem (substitui a CA normal).
-   **Ataque / Atletismo** = `max(valor da magia, valor do personagem)` — a regra "a menos que o
    seu seja maior". Requer o modificador real (por isso o import da ficha).
-   **Salvamentos, Percepção e PV** não mudam com a transformação — usam os valores reais do
    personagem (ou aproximações treinadas quando não há import).
-   Battle forms **não** alteram atributos nem concedem ataque/DC de magia (removidos do bloco).
-   Caso especial: **Ooze Form** tem CA baixa de propósito (`7 + nível`), pois é imune a crítico.

#### Convenção de dados vs. tradução

Os arquivos `data/` mantêm valores **canônicos em inglês** para campos mecânicos (tamanho, tipos
de dano nas strings de ataque, traits, sentidos, imunidades) — o `i18n.ts` traduz no render. Já
**nomes e descrições de habilidades** são armazenados em pt-BR nos próprios `data/`. Os campos
`form.description` e `spell.description/heightened` não são exibidos no layout atual (dados de
referência) e permanecem em inglês.

---

### Módulo: Monster Scaler (Escalar Monstro)

**Localização:** `src/modules/monster-scaler/`

Pega a ficha de uma criatura do Archives of Nethys e adapta para outro nível, pelas dez tabelas de
construção de criaturas do **GM Core** (pg. 112-121, níveis -1 a 24). O bloco exibido é o mesmo que
a exportação em PNG captura via `html2canvas`.

#### Arquivos

| Arquivo                          | Responsabilidade                                                              |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `MonsterScalerPage.tsx`          | Página: controles à esquerda, stat block à direita (empilhado no celular)      |
| `scaling.ts`                     | Motor puro: ficha + nível-alvo + overrides → ficha reescalada + avisos         |
| `types.ts`                       | `MonsterDetail` (o que a API devolve) e `ScaledMonster` (o resultado)          |
| `toCombatant.ts`                 | Monstro reescalado → `NpcCombatant` da Iniciativa                             |
| `data/creatureTables.ts`         | **GERADO** por `scripts/fetch-creature-tables.mjs` — não editar à mão          |
| `components/MonsterSearch`       | Busca na AON (usa `hooks/useCreatureSearch`, compartilhado com a Iniciativa)   |
| `components/ScaleAdjustPanel`    | Uma linha por estatística, com o degrau trocável                              |
| `components/MonsterStatBlock`    | Renderiza o bloco no layout Paizo (subtree capturado pelo `html2canvas`)       |
| `components/MonsterExport`       | Exportação em PNG e botão "Enviar para Iniciativa"                            |

Backend: `api/creature.js?name=` → `api/_lib/monster-core.js` (números + degraus) e
`api/_lib/creature-parse.js` (golpes, habilidades e conjuração, do campo `markdown` da AON).

#### A regra que explica o módulo

Preserva-se a **diferença** em relação ao benchmark, nunca o benchmark cru.

Criaturas publicadas são feitas à mão e não batem com a tabela: o Bugbear Tormentor é "CA Alta" com
CA 20, enquanto a tabela diz 19 no nível 3. Trocar o número pelo da tabela apagaria a personalidade
do monstro e faria reescalar para o **próprio nível** devolver uma ficha diferente da original — a
ferramenta perderia a confiança do GM no primeiro teste.

Duas exceções à diferença: **PV usa razão** (cresce quase geometricamente, de 9 no nível -1 a ~500
no 24) e o **dano** pega os dados da tabela do nível-alvo, deixando o modificador fixo absorver o
desvio do golpe original.

No ajuste fino, a **origem** da conta usa sempre o degrau que a AON deu à ficha e só o **destino**
usa o degrau escolhido. Usar o escolhido dos dois lados faz o ajuste não fazer nada: as colunas da
tabela sobem quase em paralelo e a diferença se cancela.

#### O que **não** é reescalado

Por decisão de produto, e sempre listado num aviso na página:

-   A **prosa das habilidades** fica em inglês e intocada (dados e CDs dentro do texto ficam como
    estão).
-   A **lista de magias** não muda de rank — só a CD e o ataque de magia são ajustados.
-   O **dano extra** dos golpes (`plus 2d6 fire`) fica como está: é escolha de design da criatura e
    não segue a tabela de dano de ataque.
-   Defesas com ressalva (`"physical 5 except cold iron"`) nunca viram número.

A ferramenta **nunca inventa um número que o GM não conferiu** — mesma política do
`api/_lib/creature-core.js`.

---

## 🌐 API do Servidor

O servidor (`server/index.mjs`) fornece endpoints para buscar dados da Archives of Nethys.

### Endpoints

| Método | Rota             | Parâmetros | Descrição                                       |
| ------ | ---------------- | ---------- | ----------------------------------------------- |
| GET    | `/api/health`    | —          | Health check (verifica backend disponível)      |
| GET    | `/api/feat`      | `name`     | Busca descrição de um Feat                       |
| GET    | `/api/search`    | `name`     | Busca descrição genérica (Special Abilities/itens) |
| GET    | `/api/spell`     | `name`     | Busca informações detalhadas de uma magia        |
| GET    | `/api/companion` | `name`     | Stats de companheiro animal                      |
| GET    | `/api/creature`  | `q`, `minLevel`, `maxLevel`, `limit` | Busca criaturas por nome e/ou faixa de nível — sem tradução |
| GET    | `/api/creature`  | `name`     | Ficha completa de uma criatura, com o degrau de benchmark de cada estatística — sem tradução |
| GET    | `/api/search`    | `affliction` | Venenos e doenças com estágios, salvaguarda e duração — sem tradução |
| POST   | `/api/clear-cache` | —        | Limpa o cache de descrições                      |
| GET    | `/api/state`     | `char`     | Estado de jogo compartilhado de um personagem    |
| POST   | `/api/state`     | body       | Grava uma fatia (`{ char, field, data }`)        |

As variantes **plurais** (`/api/feats`, `/api/searches`, `/api/spells`, `/api/companions`) aceitam
uma lista de nomes para busca em lote. Todas as descrições são **traduzidas para pt-BR** via Groq
antes de retornar.

`/api/creature` (nos dois modos) é a exceção: devolvem só os campos já estruturados do índice da
AON (números e vocabulário curto) e o stat block parseado, sem passar por nenhum modelo — traduzir
cada busca estouraria o rate limit do tier gratuito e deixaria a busca lenta demais para usar na
mesa. No modo `?name=`, a prosa das habilidades fica em inglês por decisão de produto.

> Os dois modos moram no mesmo arquivo porque o plano Hobby da Vercel permite **12 funções
> serverless por deploy**, e `api/*.js` já tinha 12. Confira a contagem antes de criar um endpoint.

### Exemplo de Resposta `/api/spell`

```json
{
    "name": "Heal",
    "actions": "1 to 3",
    "traits": ["concentrate", "divine", "healing", "manipulate", "vitality"],
    "range": "varies",
    "targets": "1 willing living creature or 1 undead",
    "damage": "1d8",
    "damageType": "vitality",
    "description": "Você canaliza energia positiva para curar os vivos...",
    "heightened": {
        "+1": "A quantidade curada aumenta em 1d8"
    }
}
```

### Cache

O servidor mantém um cache em memória para evitar requisições repetidas à AON.

### Estado da mesa (`/api/state`)

Único endpoint com estado. Guarda um **hash por personagem** no Redis, com um campo por fatia
(`hp`, `slots`, `conditions`, `mythic`, `pet:…`) — assim dois jogadores editando coisas diferentes ao mesmo
tempo não se sobrescrevem. O personagem é identificado por um **slug do nome** (`Ghan Buri` →
`ghan-buri`), sem o nível, para que subir de nível não zere o estado da mesa.

```bash
curl "http://localhost:3001/api/state?char=ghan-buri"
# {"char":"ghan-buri","fields":{"hp":{"data":{"current":42,"temp":7},"updatedAt":…}},"storeReady":true}
```

Sem credenciais de Redis o servidor responde igual, mas guarda só em memória — o cliente avisa
**"Só neste aparelho"** e mantém tudo no `localStorage`.

---

## 📋 Formato de Dados

### JSON de Personagem

O sistema aceita JSONs no formato **Pathbuilder 2e** ou similar. Estrutura esperada:

```json
{
    "success": true,
    "build": {
        "name": "Nome do Personagem",
        "class": "Cleric",
        "level": 8,
        "ancestry": "Android",
        "heritage": "Polyglot Android",
        "background": "Detective",
        "abilities": {
            "str": 10,
            "dex": 14,
            "con": 14,
            "int": 16,
            "wis": 19,
            "cha": 12
        },
        "proficiencies": {
            "fortitude": 4,
            "reflex": 2,
            "will": 4,
            "perception": 4,
            "acrobatics": 0,
            "...": "..."
        },
        "feats": [["Feat Name", null, "Class", 1], "..."],
        "specials": ["Special Ability 1", "Special Ability 2"],
        "lores": [["Ancient Regional", 4]],
        "weapons": [
            {
                "name": "Longsword",
                "display": "+2 Striking Longsword",
                "die": "d8",
                "pot": 2,
                "str": "striking",
                "damageType": "S",
                "attack": 14,
                "damageBonus": 3
            }
        ],
        "spellCasters": [
            {
                "name": "Cleric",
                "magicTradition": "divine",
                "spellcastingType": "prepared",
                "ability": "wis",
                "proficiency": 4,
                "perDay": [5, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
                "spells": [
                    {
                        "spellLevel": 0,
                        "list": ["Detect Magic", "Guidance", "Shield"]
                    },
                    { "spellLevel": 1, "list": ["Bless", "Fear", "Heal"] }
                ]
            }
        ],
        "featDescriptions": { "Feat Name": "Descrição do feat..." },
        "specialDescriptions": { "Special Ability": "Descrição..." },
        "spellDescriptions": { "Heal": { "...": "..." } }
    }
}
```

### Campos Opcionais Pré-preenchidos

Os campos `featDescriptions`, `specialDescriptions` e `spellDescriptions` são opcionais. Se não existirem no JSON:

1. **Com servidor rodando** (`npm run dev:full`): Busca automaticamente da AON
2. **Sem servidor**: Exibe apenas o nome com link para AON

---

## 🎯 Roadmap

### ✅ Concluído

-   [x] Estrutura base do projeto
-   [x] Sistema de navegação e layout
-   [x] **Módulo de Ficha Virtual (visualizador interativo)**
    -   [x] Layout em abas (desktop) / acordeões (mobile)
    -   [x] Presets de campanha + upload/colar JSON + restauração por sessão
    -   [x] Guias de uso "Como Jogar" (curados à mão + fallback heurístico)
    -   [x] Descrições da AON traduzidas para pt-BR sob demanda (drawer)
    -   [x] Áreas: Combate, Perícias, Talentos, Habilidades, Magias, Companheiros, Inventário
    -   [x] Estado de jogo compartilhado entre os jogadores (PV, slots, foco, condições, pontos míticos)
    -   [x] Proficiência mítica em salvaguardas, perícias e ataques + pool de 3 Pontos Míticos
-   [x] **Módulo de Ficha de Personagem (PDF)** — _desativado na plataforma_
    -   [x] Upload e parsing de JSON
    -   [x] Geração de PDF completo
    -   [x] Layout profissional print-friendly
    -   [x] Seção de Ataques detalhada
    -   [x] Seção de Magias com informações completas
    -   [x] Bônus míticos em perícias e salvamentos
    -   [x] Integração com AON (feats, specials, spells)
    -   [x] Links clicáveis para referência
-   [x] **Módulo de Iniciativa (gerenciador de combate)**
    -   [x] Importação de personagens da campanha e busca de monstros na AON (nome e/ou nível)
    -   [x] PV e condições dos personagens compartilhados com a Ficha Virtual
    -   [x] Dano em área com resultado de salvaguarda por alvo, resistência e fraqueza
    -   [x] Condições com duração em rodadas
    -   [x] Ordem de turnos com desempate RAW, ajuste manual e Adiar
-   [x] **Módulo de Escalar Monstro (criatura da AON em outro nível)**
    -   [x] Tabelas de construção de criaturas do GM Core transcritas do índice da AON (níveis -1 a 24)
    -   [x] Motor que preserva a diferença da ficha em relação ao benchmark (reescalar para o
            próprio nível devolve a ficha original)
    -   [x] Ajuste fino do degrau por estatística
    -   [x] Avisos do que não foi ajustado (prosa, lista de magias, dano extra)
    -   [x] Exportação em PNG e envio direto para a Iniciativa
-   [x] Servidor de scraping da AON

### 🚧 Em Progresso

-   [x] **Módulo de Stat Block de Transformação**
    -   [x] Interface step-by-step
    -   [x] Todas as battle forms do Remaster (inclui Ooze, Element Embodied, Avatar)
    -   [x] Importação da ficha (JSON Pathbuilder) com modificadores reais
    -   [x] Cálculos RAW (saves/percepção/ataque/atletismo reais)
    -   [x] Layout de bloco de criatura oficial, traduzido para pt-BR
    -   [x] Exportação PDF/PNG

### 📅 Planejado

-   [ ] Calculadora de Magias
-   [ ] Gerador de Encontros
-   [ ] Suporte a múltiplos idiomas
-   [ ] Temas customizáveis para PDF
-   [ ] PWA (Progressive Web App)

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

### Como Contribuir

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/NovaFuncionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/NovaFuncionalidade`)
5. Abra um Pull Request

### Padrões de Código

-   Use TypeScript com tipagem forte
-   Siga a estrutura modular existente
-   Mantenha componentes pequenos e focados
-   Documente funções complexas
-   Use nomes descritivos em português para UI, inglês para código

---

## 🤖 Contexto para IA

Esta seção fornece contexto importante para assistentes de IA trabalhando neste projeto.

### Sobre o Sistema de RPG

**Pathfinder 2nd Edition (Remaster)** é um sistema de RPG de mesa da Paizo. Conceitos importantes:

-   **Atributos**: STR, DEX, CON, INT, WIS, CHA (valores 10-20+, modificador = (valor-10)/2)
-   **Proficiência**: Untrained (0), Trained (+2), Expert (+4), Master (+6), Legendary (+8)
-   **Bônus Total**: Proficiência + Nível + Modificador de Atributo + Bônus de Item
-   **Bônus Mítico**: 10 + Nível + Modificador de Atributo (regra homebrew)
-   **CD de Magia**: 10 + Proficiência + Nível + Modificador de Atributo-Chave
-   **Archives of Nethys (AON)**: https://2e.aonprd.com/ - Referência oficial online

### Referência de Cálculos

```typescript
// Modificador de atributo
const mod = Math.floor((abilityScore - 10) / 2)

// Bônus de perícia
const skillBonus = proficiencyRank + level + abilityMod + itemBonus

// Bônus mítico (homebrew) — substitui a proficiência, não soma por cima
const mythicBonus = 10 + level + abilityMod

// Ataque com proficiência mítica: troca a parte de proficiência que já está no
// número do Pathbuilder (destreinado não soma o nível)
const mythicAttack = attack - (rank > 0 ? level + rank : 0) + (level + 10)

// CD de magia
const spellDC = 10 + proficiencyRank + level + keyAbilityMod

// Ataque de magia
const spellAttack = proficiencyRank + level + keyAbilityMod
```

### Convenções do Projeto

1. **Idioma**: Interface em português, código em inglês
2. **PDF**: Sempre print-friendly (preto, cinza, branco apenas)
3. **Fontes**: Helvetica (disponível no jsPDF por padrão)
4. **Links AON**: Formato `https://2e.aonprd.com/Search.aspx?q=TERMO`
5. **Ações de Magia**: "1 ação", "2 ações", "3 ações", "reação", "livre", "1 a 3 ações"

### Arquivos Principais para Modificações

| Funcionalidade         | Arquivo                                                     |
| ---------------------- | ---------------------------------------------------------- |
| Ficha Virtual (viewer) | `src/modules/character-viewer/CharacterViewerPage.tsx`     |
| Guias "Como Jogar"     | `src/modules/character-viewer/combatGuides.ts`             |
| Presets de campanha    | `src/modules/character-viewer/campaignPresets.ts`          |
| Layout do PDF          | `src/modules/character-sheet/pdf.ts`                       |
| Tipos + parse do JSON  | `src/modules/character-sheet/types.ts`                     |
| Stat block (battle forms) | `src/modules/transformation-statblock/`                 |
| Motor de escala de monstro | `src/modules/monster-scaler/scaling.ts`                |
| Tabelas do GM Core (geradas) | `scripts/fetch-creature-tables.mjs` → `src/modules/monster-scaler/data/creatureTables.ts` |
| Parse do stat block da AON | `api/_lib/creature-parse.js`                           |
| Núcleo do backend AON  | `api/_lib/aon.js` (serverless) · `server/index.mjs` (local) |
| Fichas de exemplo      | `public/characters/*.json`                                 |
| Tema global            | `src/theme.ts`                                             |

### Testes

Validação obrigatória de mudanças não triviais:

```bash
npm run build   # tsc -b && vite build
npm run lint    # eslint
```

Não há framework de teste no projeto. O que existe é um script de conferência do motor de escala,
que roda contra criaturas de verdade da AON:

```bash
node scripts/check-scaling.mjs 200   # 200 criaturas; sai com código != 0 se algo falhar
```

Ele confere quatro propriedades: **identidade** (reescalar para o próprio nível devolve a ficha
original), **monotonia** (subir de nível não baixa número), **ida e volta** (+4 níveis e de volta
fecha) e **ajuste fino** (trocar o degrau move o número). Rode depois de qualquer mudança em
`scaling.ts` ou nas tabelas.

Para testar a Ficha Virtual manualmente:

1. Execute `npm run dev:full` (frontend + backend de tradução)
2. Acesse http://localhost:5173 e abra **Ficha Virtual**
3. Escolha um preset de campanha (ou faça upload de um JSON Pathbuilder)
4. Navegue pelas abas e toque em talentos/magias para ver as descrições traduzidas

---

## 📄 Licença

Este projeto está sob a licença MIT.

## 🙏 Agradecimentos

-   Comunidade Pathfinder 2e
-   [Archives of Nethys](https://2e.aonprd.com/) pela referência de dados
-   [Pathbuilder 2e](https://pathbuilder2e.com/) pelo formato de JSON
-   [monster.pf2.tools](https://monster.pf2.tools) pela inspiração

---

**Desenvolvido com ❤️ para a comunidade Pathfinder 2e**
