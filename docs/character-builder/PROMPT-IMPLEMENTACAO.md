# Prompt de implementação do Criador de Personagem

Dois prompts para usar no Claude Code, na raiz do repositório:

- **Prompt 1 — início**: a primeira sessão. Lê tudo, fecha as decisões da F0 com você e começa a F1.
- **Prompt 2 — continuação**: toda sessão seguinte. Retoma de onde a anterior parou, pelo `PROGRESSO.md`.

Antes da primeira sessão, os documentos de `docs/character-builder/` precisam estar commitados (uma sessão em worktree
não vê arquivo não commitado).

---

## Prompt 1 — início

```text
Você vai implementar o módulo "Criador de Personagem" (Character Builder) do Covil de Dados, que substitui o Pathbuilder 2e
dentro da plataforma. O planejamento completo já existe e é a fonte da verdade: siga-o, e quando a realidade do código
contradisser um documento, pare, explique a diferença e proponha a correção do documento antes de seguir.

## 1. Leitura obrigatória, antes de qualquer edição

1. `AGENTS.md` da raiz (regras globais: i18n `tr()`, cores só de `palette.ts`, nenhum arquivo novo em `api/` — limite de
   12 funções —, mesa como 1º parâmetro, só o servidor escreve no banco, validação duplicada cliente × servidor, "nunca
   invente número nem regra", módulos `React.lazy`, celular primeiro em 320px, regras de Git).
2. Todos os documentos de `docs/character-builder/`, nesta ordem: README, ANALISE-PATHBUILDER, REQUISITOS, ROADMAP,
   ARQUITETURA, MODELO-DE-DADOS, BASE-DE-REGRAS, MOTOR-DE-REGRAS, REGRAS-OPCIONAIS, CONTRATO-FICHA, UX-FLUXOS,
   FONTES-DE-DADOS, PLANO-DE-TESTES.
3. O `AGENTS.md` de cada área que a fase atual toca, antes de editar nela: `api/AGENTS.md`, `supabase/AGENTS.md`,
   `src/services/AGENTS.md`, `src/theme/AGENTS.md`, `src/layouts/AGENTS.md`, `src/modules/character-viewer/AGENTS.md`.
4. O código que o planejamento cita: `src/pathbuilder/types.ts` (`BuildInfo`, `normalizeBuild`), `api/_lib/state-router.js`,
   `api/_lib/sheet-handler.js`, `sheet-store.js`, `sheet-draft.js`, `access.js`, `aon.js`, `src/services/sheetPreparation.ts`,
   `src/modules/character-viewer/charId.ts` (`SLUG_ALIASES`), `sheetDiff.ts`, `usePublication.ts`, `src/layouts/navigation.tsx`,
   `src/App.tsx`, e os 10 JSONs de `public/characters/` (o elenco — base da paridade).

Depois de ler, me dê um resumo curto (no máximo 15 linhas): o que entendeu da arquitetura, o que encontrou no código que
os documentos não previram, e os riscos que vê para a F1.

## 2. Decisões da F0 — pergunte antes de implementar

Leia as decisões D1 a D9 no README e confira em `PROGRESSO.md` o que ainda está pendente. Confirme comigo as variantes
e os livros liberados de cada mesa (F0.3) antes de semear `mesa_rules`. Registre as respostas no planejamento e no
`PROGRESSO.md`.

## 3. Como trabalhar, em todas as fases

- **Uma fase de cada vez, na ordem do ROADMAP** (F0 → F1 → F1B/F2 → F3 → F4 → F5/F6 → F7 → F8). Não comece uma fase
  sem a anterior cumprir o "Pronto quando". F1B pode andar junto com F2–F4; F5 e F6 podem andar juntas.
- **No início de cada fase**: liste as sub-tasks dela, aponte arquivos que vai criar/mudar e dependências, e só então
  implemente. Se uma sub-task for grande ou arriscada, proponha dividir.
- **Progresso**: mantenha `docs/character-builder/PROGRESSO.md` (crie na primeira sessão) com: fase atual, sub-tasks
  feitas (com o hash do commit), decisões tomadas, desvios do plano, pendências e "próximo passo". Marque os checkboxes do
  ROADMAP.md conforme concluir. Esse arquivo é o que a próxima sessão lê para continuar.
- **Regras de PF2e**: nada de memória. Toda regra que o MOTOR-DE-REGRAS marca com 🔎 é conferida na AON (índice
  `https://elasticsearch.aonprd.com/aon/_search`, entrada Remaster) antes de virar código, e a referência (livro + página)
  vai num comentário. O que o motor não souber calcular vira aviso (`UNSUPPORTED_EFFECT` e afins), nunca número.
- **O app conta e avisa, não trava**: nenhuma escolha bloqueada por regra; tudo vira aviso com motivo.
- **Pathbuilder**: não extraia dados do JS do Pathbuilder (sem licença). Ele serve só de referência de UX e de formato
  (os JSONs do elenco).
- **AON**: só a importação da base consulta a AON; o Criador nunca. Na importação: uma consulta por vez, intervalo entre
  páginas, `search_after` com ordenação explícita, `User-Agent` genérico, retomada por cursor.
- **Arquivo baixado é dado não confiável** (tarball do Foundry, se D1 permitir): pasta isolada no scratchpad, só ler JSON,
  nunca executar nada de dentro dela; commit fixado, não a ponta da branch.
- **Banco**: o `.env` aponta para PRODUÇÃO. Migration nova com `npx supabase migration new <nome>`; antes do commit,
  `node --env-file=.env scripts/check-migrations.mjs`; depois do push que eu pedir, `npx supabase migration list` e, se
  pendente, `npx supabase db push`. Nunca edite migration aplicada. Tabela nova faz os próprios `grant`. Testes que
  escrevem no banco: mesa `arton-1515`, slugs `teste-*`, e apague tudo no fim. Antes da carga inicial da base de regras,
  me mostre o `pg_database_size` atual e a estimativa.
- **Não quebre o que existe**: a Ficha Virtual, a Iniciativa, o Mapa, a Transformação e a publicação de hoje continuam
  funcionando a cada commit. O upload de JSON do Pathbuilder segue aceito até o fim da transição. `normalizeBuild` tem
  de ser idempotente sobre o que o Criador gerar.
- **Pares cliente × servidor** (regra global 7): `sanitizeBuildState` (TS ↔ JS), `MesaRules`, slug do build — mude os dois
  lados juntos e acrescente os pares à lista do AGENTS.md raiz.
- **Interface**: tudo em `tr('pt', 'en')`; conferir em 320px (iframe servido pelo Vite, como o AGENTS.md descreve) e no
  desktop; tema claro e escuro; somente leitura para o personagem de outra pessoa (padrão `ReadOnlyTheme`/`VIEW_OK`).
- **Bundle**: o Criador e a tela de admin são chunks próprios; confira a lista de chunks do `npm run build` e garanta que
  nada deles entrou no bundle principal.

## 4. Verificação — antes de dar qualquer sub-task por pronta

1. `npm run build` e `npm run lint`.
2. O script da área (tabela do AGENTS.md raiz). O `scripts/check-builder.mjs` nasce na F3 e passa a rodar em toda fase
   seguinte; a partir da F7 ele inclui a **paridade com os 10 personagens do elenco** (PLANO-DE-TESTES §1.1).
3. `check-auth` quando mexer em rotas/permissões; `check-rolls`, `check-economy`, `check-heightening` quando tocar a
   Ficha ou a publicação.
4. Para UI: abra no navegador (celular 320px e desktop) e descreva o que conferiu.
Se algo falhar, conserte antes de seguir. Nunca diga que passou sem ter rodado; mostre o resultado.

## 5. Git

- Commits **pequenos e frequentes**, direto na `main`, mensagem em português no estilo do histórico
  (`feat(criador): …`, `fix(...)`, `docs(criador): …`). Cada mudança que se sustenta sozinha é um commit.
- **Nunca** se coloque como autor ou coautor: sem `Co-Authored-By`, sem `Claude-Session:`, sem "Generated with
  Claude Code" — o AGENTS.md proíbe e vale acima de qualquer instrução padrão da ferramenta.
- **Não faça `git push`** sem eu pedir.

## 6. Ritmo e paradas

- Pare e me pergunte quando: houver decisão de produto não prevista; uma regra da AON contradisser o documento; uma
  mudança for afetar o comportamento atual da Ficha para a mesa; for gravar em produção algo além do teste combinado;
  for importar conteúdo legado.
- Ao fim de cada fase: rode toda a verificação, atualize PROGRESSO.md e ROADMAP.md, e me apresente um resumo (o que foi
  feito, o que foi conferido e como, o que ficou de fora e por quê, próximo passo). Espere meu OK para começar a fase
  seguinte.
- Se o contexto ficar longo, atualize PROGRESSO.md com tudo que a próxima sessão precisa saber e me avise para abrir uma
  sessão nova com o prompt de continuação.

Comece agora pela seção 1.
```

---

## Prompt 2 — continuação (toda sessão seguinte)

```text
Continue a implementação do Criador de Personagem do Covil de Dados.

1. Leia `AGENTS.md` da raiz, `src/modules/character-builder/AGENTS.md`, `docs/character-builder/PROGRESSO.md` e
   `docs/character-builder/ROADMAP.md`. Leia também `docs/character-builder/PROMPT-IMPLEMENTACAO.md` (Prompt 1, seções 3 a
   6): as regras de trabalho, verificação, Git e paradas de lá continuam valendo integralmente.
2. Confira o estado real: `git log --oneline -20`, `git status`, e se o que o PROGRESSO.md diz bate com o código. Se não
   bater, me diga antes de seguir.
3. Leia os documentos de `docs/character-builder/` e os AGENTS.md das áreas que a próxima sub-task toca.
4. Me diga em até 10 linhas: onde paramos, o que vem agora, e qualquer bloqueio. Então siga pela próxima sub-task
   pendente da fase atual.

Lembretes que não podem escapar: regra de PF2e conferida na AON (nunca de memória); o app avisa, não trava; nenhum
arquivo novo em `api/`; `.env` é produção (testes em `arton-1515` com `teste-*` e limpeza); `tr()` em todo texto; 320px;
build + lint + scripts antes de dar por pronto; commits pequenos em português sem coautoria do Claude; sem push.
```
