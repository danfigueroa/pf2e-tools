# Criador de Personagem (Character Builder) — documentação de planejamento

Módulo novo do Covil de Dados para **criar, evoluir e aplicar fichas de Pathfinder 2e Remaster dentro da plataforma**,
tirando a dependência do Pathbuilder 2e. Hoje o fluxo é: montar no Pathbuilder → exportar JSON → enviar na Ficha Virtual →
publicar. Com o Criador **não há arquivo nem upload**: o Criador e a Ficha Virtual são **dois modos do mesmo personagem**
— *editar* (montar, subir de nível) e *jogar* (rolar, gastar recursos). Um toque leva de um ao outro, e o que se aplica
no modo editar chega à Ficha, à Iniciativa, ao Mapa e à Transformação.

Rotas propostas: **`/personagens`** (meus personagens e os da mesa) e **`/ficha-virtual?ficha=<slug>&modo=editar`**
(o modo editar abre o Criador, num chunk próprio, dentro da Ficha). Nome de tela: "Criador de Personagem" /
"Character Builder".

## Documentos

| Documento | Para que serve |
| --- | --- |
| [ANALISE-PATHBUILDER.md](ANALISE-PATHBUILDER.md) | Inventário de tudo o que o Pathbuilder 2e faz (versão *Feylines 112.0*, analisada em 2026-11-24), com a decisão para cada item: adotar, adaptar, já existe na plataforma, ou fora de escopo |
| [REQUISITOS.md](REQUISITOS.md) | Requisitos funcionais (RF) e não funcionais (RNF), regras de negócio e critérios de aceite |
| [ROADMAP.md](ROADMAP.md) | Fases, sub-tasks, dependências, entregáveis e "pronto quando" de cada fase |
| [PROGRESSO.md](PROGRESSO.md) | Fase atual, decisões registradas e próximo passo |
| [ARQUITETURA.md](ARQUITETURA.md) | Como o módulo se encaixa: pastas, motor de regras, fluxo de dados, rotas da API, chunks, integração com os outros módulos |
| [MODELO-DE-DADOS.md](MODELO-DE-DADOS.md) | Tabelas, migrations, RLS/grants, Realtime, o formato `BuildState` (escolhas) e o catálogo de regras |
| [MOTOR-DE-REGRAS.md](MOTOR-DE-REGRAS.md) | O que o motor calcula (atributos, PV, proficiências, CA, magias, carga…), variantes (Free Archetype, Mítico, ABP…), pré-requisitos e as fontes a conferir na AON |
| [CONTRATO-FICHA.md](CONTRATO-FICHA.md) | O modelo compilado que a Ficha lê (`BuildInfo` de hoje + extensões), campo a campo, e a importação do JSON do Pathbuilder |
| [REGRAS-OPCIONAIS.md](REGRAS-OPCIONAIS.md) | Todas as regras opcionais e variantes (Mítico e suas alternativas, as 4 do GM Core, as do Gamemastery Guide como Stamina e Dual Class, relíquias, desviantes), o que cada uma muda e em que fase entra |
| [UX-FLUXOS.md](UX-FLUXOS.md) | Telas, fluxos (criar, subir de nível, editar e jogar, aplicar na mesa, importar), componentes e o comportamento no celular (320px) |
| [BASE-DE-REGRAS.md](BASE-DE-REGRAS.md) | Todo o Remaster da AON no nosso banco: tabelas, carga inicial, camada de mecânica, leitura por pacotes (sem tocar a AON) e a tela do admin que baixa só livros novos e erratas |
| [FONTES-DE-DADOS.md](FONTES-DE-DADOS.md) | De onde vêm as regras e o conteúdo (AON + pacotes do sistema PF2e do Foundry), pipeline de ingestão, licenças e riscos |
| [PROMPT-IMPLEMENTACAO.md](PROMPT-IMPLEMENTACAO.md) | Prompts para o Claude Code implementar o roadmap: o de início (lê tudo, fecha a F0, começa a F1) e o de continuação (retoma pelo `PROGRESSO.md`) |
| [PLANO-DE-TESTES.md](PLANO-DE-TESTES.md) | `check-builder.mjs`, paridade com os 10 personagens do elenco, invariantes, conferência visual e i18n |

## Decisões tomadas neste planejamento (podem ser revistas)

1. **Integração direta, sem export.** Um personagem só, com duas camadas no banco: as **escolhas** (`BuildState`, o que o
   modo editar grava) e o **retrato aplicado** (o modelo compilado que o modo jogar lê). Nenhum arquivo passa pela mão do
   jogador. O retrato existe porque (a) 88 arquivos do cliente e 3 do servidor (preparo de descrições, guia por IA,
   aquecimento da AON) leem esse formato hoje; (b) a mesa não pode ver números mudarem no meio do combate enquanto alguém
   edita (decisão já tomada: "nada troca sozinho"); (c) o histórico e o "restaurar" dependem dele.
2. **O retrato começa no formato `BuildInfo` e cresce.** No início é o mesmo formato do Pathbuilder (nada na Ficha
   precisa mudar). Depois ganha campos que o Pathbuilder nunca teve — ids de conteúdo, memória de cálculo, desarmados,
   efeitos de talento — e a Ficha passa a lê-los, aposentando os catálogos por nome e os consertos do `normalizeBuild`.
   O JSON do Pathbuilder vira só **formato de importação** (e um download opcional de backup).
3. **O que se edita é a lista de escolhas**, não os números. Os números saem de um compilador determinístico
   (`compileBuild(BuildState, RulesData) → retrato`). Assim, subir de nível, trocar um talento ou corrigir uma regra
   recalcula tudo.
4. **O app conta e avisa, não trava** (regra global 8): pré-requisito não cumprido, boost a mais, ouro negativo — tudo
   permitido, com aviso. O que o motor não sabe calcular com segurança vira aviso, não número.
5. **Remaster só.** Conteúdo legado (pré-Remaster) fica fora por padrão; o GM pode liberar livro a livro.
6. **Variantes do elenco entram no MVP**: Free Archetype, Mítico completo (chamado, talentos, destino no 12º) e Ancestry
   Paragon — todos os 10 personagens atuais usam ao menos uma delas. O mapa de todas as regras opcionais está em
   [REGRAS-OPCIONAIS.md](REGRAS-OPCIONAIS.md).
7. **Nenhum arquivo novo em `api/`** (limite de 12 funções): rotas novas entram no `state-router.js` (estado) e no
   `api/search.js` (consulta).
8. **Regras no nosso banco, não na AON ao vivo.** Todo o conteúdo de jogador do Remaster (~17,8 mil entradas) é
   importado da AON para o banco; o Criador lê por pacotes em cache e nunca consulta a AON. Uma tela de admin da
   plataforma verifica a AON e baixa **só livros novos e erratas** ([BASE-DE-REGRAS.md](BASE-DE-REGRAS.md)).
9. **Paridade antes de lançar**: o Criador só substitui o Pathbuilder quando reconstruir os 10 personagens do elenco e
   gerar os mesmos números que o export deles (`check-builder.mjs`).

## Decisões da F0

| # | Data | Decisão |
| --- | --- | --- |
| D1 | 2026-11-24 | Usar o sistema PF2e do Foundry como complemento para a mecânica e a progressão de classe, com dados sob licença compatível e commit fixo. Casar as entradas com o catálogo da AON. As descrições vêm do catálogo importado da AON. |
| D2 | 2026-11-24 | Adiar o conteúdo caseiro da mesa para a F9. As relíquias atuais continuam no catálogo da Ficha Virtual. |
| D3 | 2026-11-24 | Salvar rascunhos por mesa, como as fichas publicadas. Copiar um personagem para outra mesa fica para a F9. |
| D4 | 2026-11-24 | Permitir que o GM crie um personagem e o atribua a um jogador da mesma mesa. O fluxo entra na F8. |
| D5 | 2026-11-24 | Deixar a exportação de ficha em PDF fora do escopo. O backup opcional em JSON segue previsto na F7. |

## Decisões em aberto (precisam do usuário)

| # | Pergunta | Recomendação |
| --- | --- | --- |
| D9 | Quem administra a base de regras (é de todas as mesas)? | Tabela `platform_admins`, semeada com a sua conta |
| D6 | Riqueza inicial em nível > 1: usar a tabela "Character Wealth" do GM Core automaticamente ou deixar livre? | Mostrar a tabela como referência e aviso; não travar |
| D7 | Aplicar as edições na Ficha: automático ou com um toque em "Aplicar na mesa"? | Um toque, com o resumo do que muda. Fora de sessão (`mesas.session_started_at` vazio) pode ser automático; durante a sessão, sempre com o toque e a faixa "Nova versão" para os outros |
| D8 | Stamina, Dual Class, Gradual Boosts e outras variantes do Gamemastery Guide (legado) entram? | Só sob pedido de uma mesa (F9); Stamina mexe no dano da Ficha, Iniciativa e Mapa |
