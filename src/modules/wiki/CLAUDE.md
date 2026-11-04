# Wiki da Mesa (`/wiki/:id?`, `src/modules/wiki/`; servidor `wiki-handler.js`, `wiki-store.js`, `wiki-secrets.js`)

O mundo escrito pela mesa inteira. Tabelas `wiki_pages` e `wiki_revisions`. `?nova=<título>&tipo=<tipo>` abre o editor de
uma página nova (é como o Diário e os links vermelhos chegam).

- **Permissões** (decisão do usuário: todos editam, o GM trava), no `wiki-handler.js`, pelo papel **mesmo com
  `AUTH_REQUIRED` desligado**: membro lê as públicas, cria (sempre pública) e edita públicas não travadas; travada ou só do
  GM, só o GM; apagar (lixeira, `deleted_at`) é de quem criou e do GM; lixeira, travar, esconder/revelar e "Mostrar à mesa",
  só o GM. Quem não é da mesa: 403 até no GET.
- **Segredo por bloco `:::mestre … :::`** (`:::gm` em inglês). **O servidor corta** (`stripSecrets`): o banco guarda `body` e
  `body_public`, e **tudo** que o jogador recebe sai do público — página, busca (`wiki_search` com `p_gm`), backlinks
  (`links_public`), histórico (`wiki_revisions.body_public`). Esconder só na tela vazaria pela aba Rede.
  - O jogador edita sem ver os segredos; ao salvar, `mergeSecrets` os reencaixa (depois da mesma linha pública; senão no fim
    da mesma seção; senão no fim), lembrando `blankBefore`/`blankAfter` para não partir a frase. **Nenhum segredo se perde.**
    `:::mestre` escrito pelo jogador vira `\:::mestre`. Restaurar versão, no jogador, restaura só o público.
  - "Só o mestre" na barra (GM): `wrapBlock` parte a linha em volta da seleção, sem linha em branco.
  - `GmBlock` desenha a moldura "Só o mestre vê"; só o GM o recebe.
- **Página só do GM** (`visibility: 'gm'`): some da lista, busca e backlinks do jogador (404). Revelar = `wiki-revealed` no sino.
- **Editar → Salvar, sem autosave** (de propósito: muita gente edita, e cada "Salvar" é uma versão com autor). Rascunho do
  aparelho em `mesaKey('pf2e:wiki:draft:<id>')`. Escrita condicional pelo `updated_at` (409: "Ver a versão nova" / "Salvar a
  minha por cima"). Salvamentos da mesma pessoa em 10 min viram uma versão (`p_coalesce_ms`); até 50 versões.
- **Links**: `[[Nome]]`, `[[Nome|rótulo]]`, `[[wiki:Nome]]` (`linkTarget`/`linkName`/`linkLabel` em `blocks.ts` ↔
  `wiki-secrets.js`). Resolvem por título ou apelido **dobrados** (`foldName` = `fold` = `wiki_fold`). Os `links_*` guardam
  **nomes dobrados, não ids**: a página criada depois para um link vermelho ganha os backlinks sozinha. Links da ficha rápida contam.
- **Ficha rápida por tipo** (`kinds.ts`, `INFOBOX`); `aon` (criatura) liga a ficha da AON, com "Enviar para a Iniciativa" e
  "Escalar" (`/escalar-monstro?criatura=<nome>`) para o GM.
- Hierarquia por `parent` ("Fica em"); o servidor recusa ciclo.
- Autoria: `created_by`/`updated_by` e cada versão; nomes por `member_names(mesa, ids)` (cache de 1 min).
- **Índice compartilhado** (`useWikiIndex`): um por aba, relido a cada aviso de `mesa:<mesa>:wiki` (só o id) e a cada escrita.
  A página aberta relê sozinha, menos editando (aí avisa).
- Notificações `wiki-created`/`wiki-revealed` por trigger (edição não notifica). Troféus: `wiki-created`, `wiki-edited`
  (página de outra pessoa, um por página a cada 30 min) e `wiki-read` (abrir a página de outra pessoa, uma vez por página,
  em `noteRead`); todos levam o tipo da página. Tipo novo na Wiki = troféu dele em `WIKI_KINDS` (`trophies.js`).
- "Mostrar à mesa" (`wiki-show`): handout com `body_public` (16 KB) e capa, no mesmo `journal_reveals` + `shares`. Com
  `image`, só essa imagem + o **nome da página** (retrato de NPC, mapa de local, item). O servidor só aceita a capa ou
  uma imagem do texto **público**; nunca a de um trecho do mestre.
- **Imagem amplia ao toque** (`ImageLightbox`, em `Markdown` e na capa da ficha); para o GM, o botão "Mostrar à mesa"
  fica no próprio lightbox. Toda imagem nova do Markdown herda isso, inclusive no Diário.
- **Alinhamento** é marca de linha própria (`::esquerda`, `::direita`, `::centro`, `::justificar`; inglês também), vale
  até a próxima marca, e **não** é `:::` (não toca o parser de segredos). A Wiki é justificada por padrão
  (`<Markdown justify article dropCap>`); os botões do editor (`alignTools`) põem a marca antes e a do padrão depois da
  seleção. Código com cercas ignora a marca. `splitAlign`/`alignMark` em `blocks.ts`, testados no `check-rolls`.
- **Visual de artigo**: `Markdown article` (serifa `bodySerif`, `##` com losango e filete, citação em destaque); o
  sumário "Nesta página" vem de `headingsOf` e as âncoras de `headingSlug` (mesma função nos dois lados).
- Testes: `check-rolls` (segredos, links, dobra), `check-auth` (seção "Wiki da Mesa"), `check-trophies`.
