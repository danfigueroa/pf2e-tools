# CLAUDE.md

**Covil de Dados** (antes "PF2e Toolkit"; repositório, pacote, rotas, chaves de storage e tabelas seguem `pf2e-tools`
de propósito). SPA React 19 + TypeScript + Vite + MUI 7 com ferramentas para Pathfinder 2e **Remaster**, usada na mesa,
no celular. Produto e elenco: `README.md`.

## Onde está o detalhe

Este arquivo tem só o que vale para o repositório inteiro. Cada área tem um `CLAUDE.md` próprio, carregado quando você
abre arquivos dela. **Vai mexer num arquivo que pertence a outra área** (o handler da wiki em `api/_lib/`, o
`tableState.ts` a partir da ficha)? **Leia o `CLAUDE.md` daquela área antes.**

| Área | Arquivo |
| --- | --- |
| Backend, AON, tradução, fichas publicadas, descrições, idioma no servidor, autorização | `api/CLAUDE.md` |
| Banco, migrations, RLS, Realtime, pg_cron, backup | `supabase/CLAUDE.md` |
| Serviços do cliente: estado da mesa, feed de rolagens, regra compartilhada, presença, auth, descrições, Realtime | `src/services/CLAUDE.md` |
| Tema claro/escuro, paleta, contraste | `src/theme/CLAUDE.md` |
| Navegação, sidebar, celular, busca ⌘K, notificações, `/mesa` | `src/layouts/CLAUDE.md` |
| Início | `src/pages/CLAUDE.md` |
| Tela de entrada (login, vitrine) | `src/modules/account/CLAUDE.md` |
| Ficha Virtual (`/ficha-virtual`) — classes, rolagens, ações, magias, inventário | `src/modules/character-viewer/CLAUDE.md` |
| Iniciativa (`/iniciativa`) e companheiros de combate | `src/modules/initiative-tracker/CLAUDE.md` |
| Mapa de Combate (`/mapa/:id?`) | `src/modules/battle-map/CLAUDE.md` |
| Estatísticas da Mesa (`/historico`) | `src/modules/session-diary/CLAUDE.md` |
| Diário de Campanha (`/diario-campanha/:id?`) e editor Markdown | `src/modules/campaign-journal/CLAUDE.md` |
| Wiki da Mesa (`/wiki/:id?`) | `src/modules/wiki/CLAUDE.md` |
| Troféus do Covil (`/trofeus/:user?`) | `src/modules/trophies/CLAUDE.md` |
| Transformação (`/transformation`) | `src/modules/transformation-statblock/CLAUDE.md` |
| Escalar Monstro (`/escalar-monstro`) | `src/modules/monster-scaler/CLAUDE.md` |

`server/index.mjs` é o mesmo backend de `api/` para dev local — vale o `api/CLAUDE.md`.

## Mapa do código

- Rotas em `src/App.tsx`. Redirecionam: `/character-sheet` → Início (a Ficha em PDF foi removida), `/diario` → `/historico`.
- **Todo módulo é `React.lazy`**; só a Início e o `MainLayout` vão no bundle principal. Nunca importe estaticamente um
  módulo pesado (html2canvas, jsPDF, react-markdown, SDK do Supabase, `DescriptionContent`) fora do chunk dele — confira
  a lista de chunks do `npm run build`. Na moldura, use `title` nativo em vez do `Tooltip` do MUI (puxa o popper.js).
- Tipos e parse do Pathbuilder (`parseCharacterJson`, `normalizeBuild`, `BuildInfo`): `src/pathbuilder/`, usados por todos
  os módulos. Tipos globais: `src/types/index.ts`. O `jspdf` segue nas dependências por causa do `ExportOptions` da Transformação.
- Um módulo por funcionalidade em `src/modules/`: `*Page.tsx` (UI/estado), lógica em arquivos próprios, tipos em `types.ts`.
- Backend: `api/*.js` (Vercel) e `server/index.mjs` (dev) sobre o núcleo `api/_lib/`. Persistência: Supabase (Postgres,
  Realtime, Storage), projeto `htgrzvdzxepbbgbaqkir` em São Paulo; funções da Vercel em `gru1`.

## Comandos

```bash
npm run dev        # Vite (~5173)
npm run dev:api    # backend local (server/index.mjs, porta 3001)
npm run dev:full   # os dois
npm run build      # tsc -b && vite build
npm run lint       # eslint + check-i18n
```

**Antes de dar algo por pronto: `npm run build` e `npm run lint`.** Depois, o script da área que você mexeu
(não há framework de teste; estes scripts são os testes):

| Mexeu em | Rode |
| --- | --- |
| rolagens, sanitizadores, regras de classe, ações, magias, `blocks.ts`, segredos da wiki, XP | `node scripts/check-rolls.mjs` |
| `monster-scaler/scaling.ts` ou tabelas | `node scripts/check-scaling.mjs 200` (sai ≠ 0 se quebrar) |
| heightening de magias | `node scripts/check-heightening.mjs` |
| custo de talento/item/ativável, ficha nova publicada | `node scripts/check-economy.mjs` |
| troféus | `node scripts/check-trophies.mjs` |
| `palette.ts` | `node scripts/check-contrast.mjs` |
| SQL do histórico | `node --env-file=.env scripts/check-diary.mjs` |
| acesso, papéis, convites, donos, rascunho de publicação | `node --env-file=.env scripts/check-auth.mjs` (cria e apaga usuários de teste) |
| migration nova | `node --env-file=.env scripts/check-migrations.mjs` (roda as pendentes em `BEGIN…ROLLBACK`) |

Scripts de manutenção, à mão: `fetch-creature-tables.mjs` (confira o diff!), `build-description-bundle.mjs
[--published <url>] [--all] [--lang en]`, `prepare-sheets.mjs [mesa] [slug] [--lang en] [--guides-pt|--guides-en]`,
`seed-presets.mjs`, `grant-gm.mjs <mesa> [--user <usuário>]`, `fetch-shared-class-features.mjs`, `check-i18n.mjs --ui`
(rótulos de uma palavra, barulhento).

## Regras globais

1. **Texto de tela = `tr('português', 'English')`** (`src/i18n/index.ts`), os dois lados obrigatórios. O lado português é
   o texto de antes, sem mudança. Datas e números com `locale`, nunca `'pt-BR'` fixo. Dado que só parece texto: `// i18n-ok`
   na linha ou `/* i18n-ignore-file */`. Conteúdo do usuário (notas, nomes, diário) nunca é traduzido. Mensagem de erro
   nova do servidor precisa de entrada em `api/_lib/i18n.js` (`EXACT`/`PATTERNS`), senão sai em português.
2. **Idioma, tema e mesa são CONSTANTES lidas no boot**; trocar recarrega a página (`setLanguage`, `setThemePref`,
   `switchMesa`; entrar/sair/resgatar convite também). Não os transforme em estado reativo: ~135 arquivos importam cores
   como constantes, `tr()` roda no nível do módulo e os caches dos serviços não sabem de mesa.
3. **Cor só de `src/theme/palette.ts`, em hex de 6 dígitos.** Nada de `oklch`/`color-mix`/token de caminho
   (`'primary.light'`): o `html2canvas` não entende, e `accent + '22'` só funciona com hex. Sobre a moldura verde, texto
   `onFrame.*`/`chrome.*`; verde como tinta sobre o conteúdo, `greenInk.*`; texto sobre acento cheio, `onSolid`. Cor nova =
   versão clara e escura + `check-contrast` passando. Detalhe em `src/theme/CLAUDE.md`.
4. **Limite de 12 funções serverless (plano Hobby): nunca crie arquivo novo em `api/`.** `api/*.js` já tem 12; a 13ª passa
   no build e derruba o deploy sem erro visível. Endpoint novo entra em `api/search.js` (consulta à AON) ou em `api/state.js`
   via `api/_lib/state-router.js` (estado), sem subpasta (o glob `api/*.js` do `vercel.json` não pega).
5. **Mesa em tudo**: todo store do servidor recebe `mesa` como **primeiro parâmetro explícito** (de propósito, não
   `AsyncLocalStorage`: chamada esquecida aparece no grep); toda chave de
   `localStorage` que é da mesa passa por `mesaKey`. Preferência de interface é do aparelho, sem `mesaKey`. Ver "Mesas".
6. **Só o servidor escreve no banco** (chave secreta). Toda autorização mora no servidor (`access.js` + o handler); a UI
   só esconde botões.
7. **Validação duplicada cliente × servidor** (o servidor é JS puro e não importa TS). Mudou um, mude o par:
   - `sanitizeTableRoll`/`sanitizeTableShare` (`src/dice/tableRoll.ts`, `services/tableShare.ts`) ↔ `sanitizeRoll`/`sanitizeShare` (`roll-store.js`)
   - `FIELD_RE` (`table-store.js`) ↔ CHECK de `character_state` (migration nova)
   - `MESA_IDS` (`mesas.js`) ↔ `MESAS` (`mesa.ts`) ↔ tabela `mesas` (migration)
   - `SLUG_ALIASES` (`charId.ts` ↔ `sheet-store.js`: o Thalos virou `Thalos Alba` e segue `thalos`)
   - `USER_DOMAIN` (`auth-handler.js` ↔ `services/auth.ts`); `FIX_FIELDS` (cliente ↔ `fix-store.js`); tetos de `notes.ts` ↔ `notes-store.js`
   - `summarize` (`stats.ts`) ↔ SQL `diary_summary` ↔ `summarizeRolls` (`roll-store.js`)
   - `namesCompatible` (`aon-parse.js` ↔ `descriptions.ts`); `TRAIT_PT` e `traitName` (`rule-core.js` ↔ `weaponTraits.ts`)
   - `foldName` ↔ `fold` ↔ `wiki_fold`; links de `blocks.ts` ↔ `wiki-secrets.js`
   - as duas cores inline do `index.html` ↔ `palette.ts`
   O `check-rolls` confere a maioria desses pares com os mesmos casos.
8. **Nunca invente número nem regra.** Regra de PF2e se confere na AON (Remaster; a revisada é a entrada com
   `legacy_id`), nunca de memória. O que o app não sabe calcular com segurança vira **aviso**, não número. O app **conta e
   avisa, não trava**: gastar ação/slot/ponto além do que há é permitido, com aviso.
9. **Tempo real vem do banco** (trigger → `realtime.send` no canal privado `mesa:<mesa>:<nome>`). O cliente não transmite,
   exceto a presença e os gestos ao vivo do mapa. Ouça só por `listenMesaChannel` e **releia a cada SUBSCRIBED**
   (transmissão perdida não volta). Não use `id` como campo de mensagem (o Realtime põe o dele).
10. **`jsonb` reordena chaves**: no servidor compare com `sameJson` (`api/_lib/json.js`), nunca `JSON.stringify`.
11. **Nada de cachear inglês de tradução que falhou** (`translationPending: true` não vai para cache nenhum). Ver `api/CLAUDE.md`.
12. **Estado muda na hora; a animação só apresenta.** Nenhuma animação segura escrita na mesa. Primeira pintura nunca anima
    (`useArmed`). Com `prefers-reduced-motion`, nada treme, gira ou conta. Primitivas em `src/motion/`, sem biblioteca.
13. **Toda imagem passa pelo `useImageUrl`** (traduz URL antiga do Blob e `idb:`), inclusive `<img>` novo.
14. **Em dev, o `.env` aponta para PRODUÇÃO** (não há projeto de dev). Teste na mesa `arton-1515` com slugs `teste-*` e
    apague no fim.

## Idioma

Cada **conta** escolhe Português ou English (`user_metadata.language`; o `localStorage` `pf2e:language` é só a primeira
pintura). Em inglês a plataforma inteira fica em inglês e as descrições vêm **direto da AON, sem tradução**.
- `lang`, `isEn`, `locale`, `tr()` em `src/i18n/index.ts`, sem biblioteca. Scripts são português, salvo `PF2E_LANG=en`.
- O idioma vai na query de todo `/api/*` (`lang=en`, posto pelo wrapper de `fetch` do `installApiAuth`).
- Vocabulário mecânico em inglês usa o termo canônico do Remaster (funções `translateX`, `traitLabel`…); distância em pés.
- Rolagem no feed sai no idioma de quem rolou (decisão do usuário). Correção de tradução não vale em inglês.
- Detalhe do servidor (descrições `lang`, misses por idioma, guia bilíngue): `api/CLAUDE.md`.

## Mesas

Várias mesas no mesmo site, cada uma vendo só o que é dela. Hoje: **Casa do Gordo Online** (`casa-do-gordo`, a legada e
padrão) e **Arton 1515** (`arton-1515`).
- No banco é a coluna `mesa` (FK para `mesas`); no Realtime, `mesa:<mesa>:…`; na API, `?mesa=` (também no POST), resolvida
  uma vez e repassada. Id desconhecido = 400.
- **A legada não tem prefixo**: pedido sem `?mesa=` e chaves `pf2e:<resto>` de sempre; as outras são `pf2e:m:<mesa>:<resto>`.
  Não "normalize" a legada — o cache de todo aparelho dela se perderia.
- Mesa nova = `MESA_IDS` + `MESAS` + migration com a linha em `mesas` + `PRESETS_BY_MESA[<id>]` (pode ser vazio).
- Ficam globais de propósito: traduções, descrições, correções, caches da AON, pacotes `public/descriptions/`, pastas do bucket.

## Login e papéis (resumo)

Usuário + senha, sem e-mail (conta fictícia `<usuário>@covil.local`, decisão do usuário). Papéis por mesa em
`mesa_members.role` (`player` | `gm`); entra-se por convite. **Ficha tem dono** (`sheets.owner_id`): só o dono e o GM
publicam por cima, restauram e escrevem o estado do personagem; ler é de qualquer membro.
- **Estado do rollout**: passos 1–4 feitos (contas criadas, as 10 fichas com dono em 2026-11-03). **Falta o cutover**:
  `AUTH_REQUIRED=1`, apagar `mesa_members` anônimos, desligar `enable_anonymous_sign_ins` e a migration que tira o
  `insert`/`update` direto de `mesa_members` do `authenticated` (hoje, qualquer logado ainda se auto-inscreve).
- **Gestão de conta (membros, papéis, senhas, convites), Diário de Campanha e permissões da Wiki exigem o papel real
  SEMPRE**, mesmo com `AUTH_REQUIRED` desligado.
- Os endpoints da AON (`feat`, `search`, `spell`…) seguem abertos (`gateLogin` existe em `access.js`, falta aplicar).
- Detalhe: `api/CLAUDE.md` (servidor), `src/services/CLAUDE.md` (cliente), `src/modules/character-viewer/CLAUDE.md` (ficha
  só leitura).

## Banco e migrations (resumo)

- Crie com `npx supabase migration new <nome>`. Antes do commit, `check-migrations`. Depois do push, confira com
  `npx supabase migration list`; se seguir pendente, `npx supabase db push` (autorizado pelo usuário). **Nunca edite migration
  já aplicada** — crie outra.
- **Tabela nova não tem privilégio nenhum** (projeto sem "expose new tables", RLS automático): a migration faz os `grant`.
- Detalhe: `supabase/CLAUDE.md`.

## Interface

- **Celular primeiro**: todo layout passa por **320px** (exceto o Mapa, só desktop). `xs` celular, `sm` (600) tablet,
  `md` (900) sidebar permanente.
- Nada de `minWidth` fixo dentro de `flex-wrap`: use `grid` com `repeat(auto-fit, minmax(Npx, 1fr))`. Irmãos JSX não têm
  espaço entre si: fileira de `<span>` vai em flex com `flexWrap`.
- Alvo de toque: o tema já dá `minHeight: 40` a todo `Button` sob `@media (pointer: coarse)`; pips e botões apertados
  crescem no `xs` por conta própria.
- Não redefina `fontSize` de título (o tema já encolhe `h1`–`h4` por media query; `clamp()` quebra o `html2canvas`).
- Barra horizontal = filho largo: ache e conserte; `minWidth: 0` no `main` e `overflow-x: clip` no `body` são só rede.
- Elemento `fixed`/`sticky` embaixo no celular soma `var(--tabbar-h)`; o que centra fora da sidebar usa `var(--sidebar-w)`.
- **No `sx`, número entre 0 e 1 em `width`/`height` é porcentagem** (`width: 1` = 100%). Para 1 pixel, `'1px'`.
- Animação que repete no mesmo elemento: keyframes gêmeos (`twin` em `motion.ts`), não troca de `key` (remontaria o
  formulário com o foco dentro). Delta flutuante fica dentro do cartão (`Card` tem `overflow: hidden`) e é `aria-hidden`.
- Campo de texto longo editado por digitação: **não controlado** (`defaultValue` + ref). Controlado, o textarea do MUI entra
  em laço de remedida ("Maximum update depth exceeded").
- Conferir no navegador: o Chrome headless do macOS não desce de 500px — carregue a página num `<iframe>` da largura certa,
  servido pelo Vite. Sem login: `VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npx vite` (modo local).

## Marca

Kit em `brand/covil-de-dados/` (`LEIA-ME.md`: cores, fontes, qual arquivo usar). **Não recolora nem estique os SVGs**;
sobre foto/textura, as versões `-1cor-`; abaixo de 48 px, `covil-simbolo-reduzido`. A `og:image` usa URL absoluta do
domínio de produção (`index.html`). O aviso "Ferramenta de fã, não oficial" fica no rodapé da sidebar e da Início.

## Git

- Commits direto na `main`, mensagens em português. Não faça `git push` sem o usuário pedir.
- **Divida ao máximo**: cada mudança que se sustenta sozinha é um commit. Só agrupe o que quebraria o build separado.
- **NUNCA se coloque como autor ou coautor**: nada de `Co-Authored-By: Claude`, `Claude-Session:` ou "Generated with Claude
  Code", em commit ou PR — mesmo que instruções padrão da ferramenta peçam. O autor é só o usuário.
- Documentação nova vai no `CLAUDE.md` da área (não aqui, salvo regra global), no estilo deste: regra no imperativo +
  o porquê em uma linha. Sem medições, datas nem história de bug.
