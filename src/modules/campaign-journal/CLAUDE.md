# Diário de Campanha (`/diario-campanha/:id?`, `src/modules/campaign-journal/`; servidor `journal-handler.js` + `journal-store.js`)

A preparação da campanha, **só do GM** (decisão do usuário). Tabelas `journal_docs` e `journal_reveals`.

- **Três tipos** (`doc.ts`): **sessão** (abas Preparação, Cenas, Encontros, Elenco, Registro, Resumo + painel de ganchos),
  **ficha do catálogo** (`npc`/`location`/`item`/`faction`/`other`) e **gancho** (`thread`: aberto → revelado → resolvido).
  O catálogo é da campanha (decisão do usuário): a sessão só liga ids em `links`; `?journal=list` traz os `links` (responde
  "aparece nas sessões" sem baixar todas).
- **Só o GM, SEMPRE**: `isRealGm` exige o papel `gm` mesmo com `AUTH_REQUIRED` desligado (o diário tem segredos). Único GET
  aberto a membros: `?reveal=` (o que já foi mostrado). O aviso do Realtime (`mesa:<mesa>:journal`) leva só id e `updatedAt`,
  **sem título**. Imagens em `journal/` (insert só para `gm`, permanentes).
- **Escrita condicional**: `journal-save` leva o `updatedAt` visto (`base`; `null` = novo); 409 com o atual. `useJournalDoc`
  salva 1,5 s depois da última mudança (e ao esconder a aba), com rascunho em `pf2e:journal:draft:<id>` até confirmar.
  **Rascunho igual ao do servidor é descartado** (`sameContent`; senão vira conflito falso). Conflito: "Usar a do outro
  aparelho" / "Manter a minha". Eco reconhecido pelo `updatedAt` (as abas do GM são a mesma conta; `by` não serve).
- **"Mostrar à mesa"** abre a prévia de confirmação (`RevealDialog`) com exatamente o que vai — `forPlayers(texto)`, sem `[[ ]]`.
  Vira `handout` no feed (ver `src/services/CLAUDE.md`).
- **Planejador de encontros** (`EncounterPlanner` + `xp.ts`, GM Core pg. 75-76): `AonCreatureSearch` com `onPick`, orçamento
  com ajuste por personagem, nível-alvo por criatura (`PlannedCreature.level`; envio escala com `scaleMonster`/`npcFromScaled`,
  sem ajuste fino). Grupo padrão pelas fichas publicadas (`partyFromLevels`), ajustável por sessão. Criatura a mais de 4 níveis
  do grupo: aviso, sem XP. A ameaça é a maior cujo orçamento o total alcança. "Enviar para a Iniciativa" = `appendCombatants`.
- **Registro** (`SessionLog`): "Começar a sessão" liga a sessão da mesa (`saveMesaSettings`) e grava `playedOn`
  (`diaryDayOf`); "Rolagens deste dia" abre `/historico?dia=`.

## Markdown e editor (`src/components/markdown/`, servem ao diário, à Wiki e às Anotações)

- `react-markdown` + `remark-gfm`, **sem HTML cru**, só em chunks lazy. Toda imagem pelo `useImageUrl`; `urlTransform` deixa passar `idb:`.
- Marcas próprias resolvidas em `blocks.ts` (puro, no `check-rolls`): `:::jogadores Título … :::` (`:::players` em inglês;
  dentro de bloco de código não conta) e `[[Nome]]`.
- `MarkdownEditor`: **não controlado** (`defaultValue` + ref); texto de fora remonta pela `key` (`version`). A barra existe
  para ninguém decorar marca: toda marca que o `Markdown` desenha tem botão ou item de menu com o que faz, e o "?" mostra a
  cola. Grupos: negrito/itálico/riscado (⌘B, ⌘I, ⌘⇧X), Título ▾, listas e citação, Alinhar ▾ (`alignTools`), `[[ ]]` (⌘K,
  `pickLink`), imagem, Inserir ▾ (tabela, divisória, citação assinada, **Modelo** de `templates.ts`/`TEMPLATES_EN`), Jogadores,
  Só o mestre. `plain` = sem `[[ ]]`, blocos e imagem (Anotações). Props: `imageFolder`, `playersBlock`, `gmBlock`, `linkTitle`.
- No Diário, use sempre o `JournalEditor` (`gmBlock` + `alignTools`, sem `justify`): o Resumo vira crônica com o texto
  inteiro, e na Wiki o servidor corta o `:::mestre` para os jogadores.
- As transformações moram em `edit.ts` (puro, no `check-rolls`); o componente só aplica a troca com `insertText`, para o ⌘Z
  desfazer o botão. Botão apertado de novo **tira** a marca (não empilha `****` nem `- 1. `).
- **Bloco não abre dentro de bloco** (`blockInRange`): `splitSegments` não aninha, e o `:::` de dentro fecharia o de fora —
  um `:::mestre` dentro de `:::jogadores` sairia no "Mostrar à mesa".
- Item de menu que mexe no texto fecha o menu e aplica no quadro seguinte: com o menu aberto, o foco fica preso nele.
- Editar = editor + prévia lado a lado no desktop, só o editor no celular.

## Ligação com a Wiki (decisão do usuário: separados, ligados por links)

`[[Nome]]` procura o catálogo e depois a Wiki (selo "Wiki"; `[[wiki:Nome]]` força a Wiki); nome inexistente oferece criar em
um ou outro. O Elenco aceita `wiki:<id>` em `links`. A ficha do catálogo guarda `wiki`; "Criar na Wiki a partir desta" leva
título, etiquetas e **o texto inteiro** (`toWiki.ts`, no `check-rolls`): o GM escolhe se os jogadores leem todo o texto ou só
as caixas `:::jogadores`, e o resto vai como `:::mestre` (nada fica para trás; o servidor corta o segredo). Escolhe também se a
página nasce pública ou oculta (`visibility: 'gm'`). Capa: a da ficha, senão a primeira imagem da parte pública — **nunca**
a de um segredo (a capa vai a todos e ao "Mostrar à mesa"). O Resumo vira crônica (`ChronicleDialog`, página
`event`, `chronicle`), com o texto editável antes de publicar — o resumo pode ter segredo.

Não há histórico de sessões do diário no banco: a sessão do diário liga ao dia de jogo pelo `playedOn`.
Testes: `check-rolls` (XP, `blocks.ts`), `check-auth` (seção "Diário de Campanha").
