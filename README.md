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

O toolkit expõe **três ferramentas** (rotas em `src/App.tsx`), listadas na página inicial:

| Ferramenta                    | Rota              | Módulo                                | O que faz                                                              |
| ----------------------------- | ----------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| **Ficha Virtual**             | `/ficha-virtual`  | `src/modules/character-viewer/`       | Visualizador interativo da ficha, com descrições da AON traduzidas     |
| **Ficha em PDF**              | `/character-sheet` | `src/modules/character-sheet/`        | Gera uma ficha completa em PDF (jsPDF)                                  |
| **Stat Block de Transformação** | `/transformation` | `src/modules/transformation-statblock/` | Gera o stat block de qualquer _battle form_ do Remaster              |

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
-   👥 **Estado compartilhado da mesa**: PV, PV de companheiros, slots de magia, pontos de foco e
    condições são os **mesmos para todos os jogadores** — marcar 50 de dano no notebook aparece no
    celular de quem estiver na mesa. A sincronia é **sob demanda**: puxa ao abrir a ficha e no botão
    **Atualizar** do cabeçalho, que também mostra se o que você vê está compartilhado.
    Requer um Redis configurado (ver [Instalação](#-instalação-e-execução)); **sem ele o app funciona
    igual**, só que o estado fica no aparelho, como antes.
-   ⚔️ Cálculos derivados (modificadores, PV, CA, salvamentos, ataques, dano de arma) via
    helpers reutilizáveis (`helpers.ts`).

### ✅ Ficha de Personagem em PDF (Implementado)

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

### 🚧 Em Desenvolvimento

-   Calculadora de Magias
-   Gerador de Encontros
-   Calculadora de Iniciativa

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
│   │   ├── character-sheet/      # Módulo de Ficha em PDF
│   │   │   ├── CharacterSheetPage.tsx  # Página principal
│   │   │   ├── pdf.ts                  # Geração do PDF
│   │   │   └── types.ts                # Interfaces + parseCharacterJson (reusado pelos módulos)
│   │   └── transformation-statblock/   # Módulo de Stat Blocks
│   │       ├── TransformationPage.tsx   # Fluxo em steps
│   │       ├── i18n.ts                  # Tradução pt-BR (vocabulário mecânico + nomes)
│   │       ├── components/              # CharacterInput, FormSelector, StatBlockGenerator, ExportOptions
│   │       └── data/                    # 1 arquivo por magia + spells.ts + from-pathbuilder.ts
│   ├── pages/
│   │   └── HomePage.tsx          # Página inicial (cards das ferramentas)
│   ├── services/
│   │   └── descriptions.ts       # Cliente do backend (busca + cache das descrições AON)
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
| `helpers.ts`                | Cálculos derivados: `abilityMod`, `totalHp`, `spellcasterStats`, `isMythicCharacter`, … |
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
| POST   | `/api/clear-cache` | —        | Limpa o cache de descrições                      |
| GET    | `/api/state`     | `char`     | Estado de jogo compartilhado de um personagem    |
| POST   | `/api/state`     | body       | Grava uma fatia (`{ char, field, data }`)        |

As variantes **plurais** (`/api/feats`, `/api/searches`, `/api/spells`, `/api/companions`) aceitam
uma lista de nomes para busca em lote. Todas as descrições são **traduzidas para pt-BR** via Groq
antes de retornar.

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
(`hp`, `slots`, `conditions`, `pet:…`) — assim dois jogadores editando coisas diferentes ao mesmo
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
    -   [x] Estado de jogo compartilhado entre os jogadores (PV, slots, foco, condições)
-   [x] **Módulo de Ficha de Personagem (PDF)**
    -   [x] Upload e parsing de JSON
    -   [x] Geração de PDF completo
    -   [x] Layout profissional print-friendly
    -   [x] Seção de Ataques detalhada
    -   [x] Seção de Magias com informações completas
    -   [x] Bônus míticos em perícias e salvamentos
    -   [x] Integração com AON (feats, specials, spells)
    -   [x] Links clicáveis para referência
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
-   [ ] Calculadora de Iniciativa
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

// Bônus mítico (homebrew)
const mythicBonus = 10 + level + abilityMod

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
| Núcleo do backend AON  | `api/_lib/aon.js` (serverless) · `server/index.mjs` (local) |
| Fichas de exemplo      | `public/characters/*.json`                                 |
| Tema global            | `src/theme.ts`                                             |

### Testes

Validação obrigatória de mudanças não triviais:

```bash
npm run build   # tsc -b && vite build
npm run lint    # eslint
```

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
