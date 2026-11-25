# Progresso do Criador de Personagem

## F0 — Decisões e preparação concluídas

- **0.1 e 0.5 concluídas em `01c64ee`.** D1 aprovada em 2026-11-24. O sistema PF2e do Foundry complementa a mecânica e a progressão, com dados de licença compatível em um commit fixo. O catálogo e as descrições vêm da AON. O guia do módulo e seu link no guia da raiz foram criados.
- **0.4 concluída em `9b689b4`.** A fonte complementar foi fixada na release `pf2e-8.7.1` e no SHA completo em [FONTES-DE-DADOS.md](FONTES-DE-DADOS.md). A cobertura das classes será validada na F1.
- **0.2 concluída em `ff7a255`.** D2 e D3 aprovadas em 2026-11-24. Conteúdo caseiro fica para a F9 e as relíquias permanecem no catálogo atual da Ficha. Rascunhos são por mesa e a cópia entre mesas fica para a F9.
- **D4 aprovada em 2026-11-24.** Na F8, o GM poderá criar um personagem e atribuí-lo a um jogador da mesma mesa.
- **D5 aprovada em 2026-11-24.** Exportação em PDF fica fora do escopo. O backup opcional em JSON segue previsto na F7.
- **D6 aprovada em 2026-11-24.** Acima do nível 1, a tabela Character Wealth do GM Core será exibida como referência. O Criador avisa sobre divergências e permite seguir com o valor escolhido.
- **D7 aprovada em 2026-11-24.** A ficha publicada muda após revisar e confirmar **Aplicar na mesa**, durante e fora de sessão. As escolhas são salvas no rascunho ao editar.
- **D8 aprovada em 2026-11-24.** Stamina, Dual Class e Gradual Boosts ficam para a F9 sob pedido de uma mesa.
- **D9 aprovada em 2026-11-24.** `danfigueroa` será a conta administradora inicial da base. A conta foi conferida em consulta somente leitura. A semente entra na F1.
- **0.3 concluída em `6794e1d`.** Casa do Gordo Online e Arton 1515 confirmaram Free Archetype, Mítico, Ancestral Paragon e todos os livros Remaster da carga inicial em 2026-11-24. Livros legados e livros importados depois dependem de liberação do GM. Veja a tabela de sementes em [MODELO-DE-DADOS.md](MODELO-DE-DADOS.md#3-mesa_rulesrules).
- **0.6 concluída em `9fcaaaf`.** A regra global 7 agora registra os pares de validação de `sanitizeBuildState`, `MesaRules` e slug do build para a F2.
- **0.7 concluída em `f5c3f18`.** O export real do Pathbuilder foi preservado em `scripts/rules-data/samples/pathbuilder-inventory-formula.json`. O [contrato da ficha](CONTRATO-FICHA.md#4-equipamento) registra a posição do ID do contêiner e a forma dos grupos de fórmulas.
- **Verificação.** `npm run build`, `npm run lint` e `git diff --check` passaram. O Vite emitiu o aviso de tamanho de bundles.
- **Ajuste proposto para a F7.** Explicitar a leitura do catálogo local na publicação do Criador e a propagação do slug estável aos consumidores do estado da mesa.

## F1 — Base de regras no banco em andamento

- **1.1 concluída em `a0bc4a0`.** Migration local criada e validada em `BEGIN…ROLLBACK`. `pg_database_size` retornou 26.523.315 bytes (25 MiB). A estimativa preliminar é ~40 MB de dados brutos, antes dos índices e da mecânica do Foundry. A projeção final depende da amostra normalizada.
- **1.2 concluída em `c5c5d6a`.** A leitura usa `search_after` e `id.keyword`, com uma requisição por vez e intervalo entre consultas. Verifiquei duas páginas de livros e duas de talentos do Player Core na AON, além de uma falha HTTP simulada com retentativa no mesmo cursor.
- **Verificação.** Build, lint, checagem de whitespace e validação da migration passaram. Os dez exports do elenco cobrem nove classes, e a análise e o roadmap já refletem a contagem.
- **1.3 e 1.4 concluídas em `41199c5`.** A identidade é `tipo:aon_id`, porque a AON repete nomes dentro de `feat`, `equipment` e `class-feature`. O nome e o slug ficam para exibição e busca.
- **1.5 concluída.** A derivação fica em `rules_entries.data.derived` (decisão: é projeção da própria AON e acompanha o `hash`; `rules_mechanics` fica para `foundry` e `manual`, sem conflito de origem na classe). Conferida ao vivo contra as 29 classes Remaster, 500 backgrounds e 371 armas. O que depende de subclasse, divindade, armas de fogo e Lore à escolha vai para `derived.unsupported`. A Longsword sai `Slashing`; armas `modular` ficam sem tipo de dano.
- **Catálogo: `tactic`, `element` e `epithet` incluídos.** Commander, Kineticist e Exemplar. São categorias de jogador da AON que faltavam em `RULE_CATEGORIES`. A AON não tem `ancestry-feature`; essas entradas do Foundry ficam sem casamento.
- **1.6 concluída.** Núcleo em `api/_lib/rules-foundry.js` e leitura do tarball em `scripts/rules-data/foundry-packs.mjs` (commit fixado, só os 11 pacotes de jogador, só JSON, pasta temporária apagada no fim). Conferido contra um despejo completo da AON nas 68 categorias:
  - 17.587 documentos, 16.446 casados (93,5%), 19 ambíguos, 1.122 sem par. Os sem par são sobretudo tesouros e gemas sem mecânica, ações de arquétipo e características que a AON não separa. Resultado: 16.004 linhas (~3,2 MB); 4.040 com rule elements e 1.639 com algo em `unsupported`.
  - Progressão: os níveis de talento (classe, ancestralidade, geral, perícia) e de aumento de perícia das 29 classes batem com a tabela de avanço da AON (`checkProgression`). As características das nove classes do elenco casam, exceto as seis Doctrines do Cleric (a AON tem uma entrada "Doctrine"), Weapon Mastery do Ranger (via `replaced_by` → Martial Weapon Mastery) e Psychic Weapon Specialization. Esses aliases entram no `corrections.json` da 1.7.
  - Não suportados mais frequentes, para priorizar a F4: `ItemAlteration` (861), `AdjustModifier` (154), `DamageAlteration` (77), `Aura` (76), `ActorTraits` (54), `ActiveEffectLike` de habilidades de familiar (32), `CreatureSize` (28).
- **Pendências registradas.**
  - Stylish Tricks também dá um aumento de perícia restrito nos níveis 3, 7 e 15, que o `skillIncreaseLevels` do Foundry não inclui. O motor da F3 trata.
  - Kineticist (Rage of Elements, ago/2023) não tem versão Remaster e sai `remaster: false` pela regra da 1.4. Para a classe entrar, o livro precisa ser liberado na mesa.
- **1.7 concluída.**
  - `spell-slots.json` e `wealth.json` são **gerados** da AON por `scripts/fetch-rules-tables.mjs`, não digitados (decisão: mesma razão do `fetch-creature-tables`). Cobrem as 12 classes conjuradoras e a Character Wealth.
  - As notas de rodapé das tabelas (`*`, `†`) ficam em `notes`. O Animist guarda pares `[classe, aparição]`.
  - Os benefícios de arquétipo vêm de Player Core pg. 215.
  - Conferência com o elenco: Magus 10, Psychic 10 e Cleric 7 batem. O Loki (Magus 7) tem um truque a mais no export, que vem de talento e não da tabela.
  - `exports.json` traz os rótulos e nomes de conjurador do Pathbuilder, tirados do elenco.
  - `corrections.json` traz os aliases da progressão (Doctrines do Cleric, Premonition Reflexes, Psychic Weapon Specialization), cada um com o livro e a página. Com eles, as nove classes do elenco têm progressão 1–20 com todas as características casadas.
- **1.8 concluída.** `scripts/import-rules.mjs` e `api/_lib/rules-store.js`. Migration `base_de_regras` aplicada em produção em 2026-11-24, com a semente de `platform_admins`: 1 linha.
  - **Carga inicial feita.** 161 livros Remaster, 17.613 entradas e 11.774 linhas de mecânica do Foundry. Versões do catálogo: `2026.11.1` (Player Core) e `2026.11.2` (carga completa).
  - **Espaço.** O banco foi de 25 para 67 MB: `rules_entries` ocupa 37 MB e `rules_mechanics` 4,3 MB.
  - **Idempotência.** Reimportar o Player Core deu 0 alteradas. As 45 inválidas são subações sem nome dentro de itens.
  - **Progressão.** Os níveis de talento e de perícia batem com a AON nas 29 classes. As características das nove classes do elenco estão todas casadas.
  - **Aliases novos em `corrections.json`.** Ranger Weapon Mastery, Rogue Debilitating Strikes, Witch Hexes e Magus Studious Spells. Eles eram necessários porque, sem os livros legados, o caminho pelo `replaced_by` não existe.
  - **Sem par na AON, fora do elenco.** Inventor (Churning Mind, Perception Expertise, Anvil's Hardness), Oracle (Oracular Curse, Revelation Spells), Sorcerer (Bloodline Spells) e Thaumaturge (Exploit Vulnerability, Reflex Expertise). O motor avisa; os aliases entram conforme essas classes forem conferidas.
- **1.9 concluída.**
  - **Pacotes da versão `2026.11.2` no bucket `rules`.** 322 arquivos e 10,2 MB no total. Os maiores: `items/consumables` com 1 MB e `core/actions` com 756 KB; os de classe têm dezenas de KB com gzip.
  - **Conferido pelo CDN.** `core/classes` traz as 28 classes, com `featLevels`, `skillIncreaseLevels` e as características ligadas a `class-feature:<aon_id>`.
  - **Rota de reserva.** `?rules=` e `?rules=search` testadas no servidor de dev: 200 com cache imutável, 400 para lista inválida e 404 para lista inexistente, com o erro no idioma do pedido.
  - **`?me=1`** agora traz `rulesVersion`, com cache de 60 s.
- **1.10 concluída.**
  - `rules/loader.ts` carrega na ordem: memória → IndexedDB `pf2e-rules` (chave `pf2e:rules:<versão>:<lista>`) → Storage → reserva `?rules=`. Se o IndexedDB estiver bloqueado, fica só na memória.
  - `rules/index.ts` traz `featsFor`, `spellsFor`, `itemsBy` e as listas de `core/`. `rules/types.ts` é o `RuleEntry` real dos pacotes.
  - A versão vem do `?me=1` por `src/services/rulesVersion.ts`, separado do `auth.ts` para o chunk do Criador não puxar a sessão. Sem ela, vem do manifesto.
  - Teste no Node contra a API de dev: Magus com Human, geral, perícia e Psychic até o nível 7 deu 320 talentos, 411 magias arcanas até o rank 4 e 365 armas. Foram 8 pedidos, só das listas usadas; a segunda consulta saiu da memória. Nenhum pedido à AON.
- **1.11 concluída.** `scripts/build-rules-fixture.mjs` gera `scripts/rules-data/fixture.json` (~0,8 MB, versão `2026.11.2`) a partir dos pacotes publicados. Entram inteiras as listas pequenas do `core`; das demais, só o que os 10 personagens do elenco usam, mais as características da progressão das classes deles.
- **Achado para a F7 (paridade com o elenco).** 98 nomes do elenco não têm entrada no catálogo Remaster:
  - **Conteúdo legado.** Android, Fleshwarp e Artisan Android (Impossible Lands), Lesser Scion, Hydra's Bond, Wavetouched Paragon, Genie-Blessed, Mentalist's Staff (Greater)… A paridade vai exigir importar esses livros com `--source` e liberá-los nas mesas (D3/0.3: livro legado depende de liberação do GM).
  - **"Specials" compostos do Pathbuilder.** Atributos, perícias e rótulos como "Studious Spell: Blur", "Empiricism Selected Skill: Occultism" e "Standard Cantrip: Shield (Archetype)". O compilador gera esses rótulos; eles não vêm do catálogo.
  - **Caseiros.** Braço Sônico, Miranda's Arm e Loki's Heart, todos do catálogo de relíquias da Ficha (D2).
  - **Opções com outro nome na AON.** "Thief Racket" é "Thief"; "Giant Instinct" é "Giant". Entram no `exports.json` ou no `corrections.json` na F7.
- **1.12 concluída.**
  - `/creditos` (`src/pages/CreditsPage.tsx`, chunk próprio de 2,8 KB gzip) tem um link no rodapé da sidebar, ao lado do aviso de fã.
  - O texto da Community Use Policy (paizo.com/licenses/communityuse) e o ORC Notice (paizo.com/orclicense, seção a) estão citados literalmente, em inglês nos dois idiomas, porque são texto legal. A Attribution Notice lista os livros importados como "© Paizo Inc.", lidos de `core/sources`.
  - Os pacotes passaram a listar só livros com entradas importadas: 80 de 161.
  - Conferido em 320 px e no desktop pela captura via CDP do Brave; o `--screenshot` do Brave headless trava neste Mac.
- **F1: estado do "Pronto quando".**
  - As contagens por livro batem com a AON. A diferença está só nas 45 subações sem nome.
  - As nove classes do elenco têm progressão 1–20 completa.
  - O carregador não faz chamada à AON. Conferido na rede com a primeira tela do Criador (F2): abrir "Criação de personagem" em `/mesa` pediu só o manifesto e `core/sources` do nosso catálogo e listou os 80 livros, com 0 pedidos à AON.

## F2 — Esqueleto e persistência concluída

- **2.1** Migration `criador_de_personagem` aplicada em produção em 2026-11-25. `character_builds` (teto de 96 KB no `state`, além dos 64 KB do servidor), `character_build_versions`, `mesa_rules` e `sheets.build_id`.
  - O teto de 30 versões por build é um trigger no insert, não `pg_cron`: corta na hora, como o `publish_sheet`. A lixeira (30 dias, só sem ficha aplicada) é `pg_cron`.
  - Semente de `mesa_rules` nas duas mesas: os 80 livros Remaster com entradas, `legacy: false`, Free Archetype, Mítico (progressão por nível) e Ancestral Paragon.
  - **Decisões.** Raridade padrão `ask` (incomum e raro geram aviso "pedir ao GM", nada é negado). Nível inicial 1 e riqueza pela tabela do GM Core. A chave da variante ficou `ancestralParagon` nos dois tipos; a REGRAS-OPCIONAIS dizia `ancestryParagon`.
- **2.2–2.5** `build-sanitize.js`, `build-store.js` e `build-handler.js`, despachados antes da ficha. O `server/index.mjs` já usa o mesmo `routeState`, então o dev local ganhou as rotas sem mudança.
  - Escrever é do dono ou do GM **real** mesmo com `AUTH_REQUIRED` desligado, porque o build tem dono desde o nascimento. Criar exige estar logado.
  - O slug é o primeiro livre na mesa entre builds e `sheets` (`ana`, `ana-2`…). Renomear não muda o slug.
  - `build-assign` (GM troca o dono) entrou já, porque o `check-auth` pedia. O "Criar para…" na tela fica para a F8.
  - A lista traz `ownerName` pela função `member_names`, a mesma da autoria da Wiki.
  - Sem Supabase, o handler usa um GM local (`local`), para a interface rodar no modo memória.
- **2.6** `types.ts`, `sanitize.ts` e `mesaRules.ts` no cliente. `buildSlugFromName` em `charId.ts`. `scripts/check-builder.mjs` roda 62 conferências com os mesmos casos nos dois lados.
- **2.7–2.10** Rota `/personagens/:buildId?` (chunk próprio de 8 KB gzip) e item "Personagens" em JOGO, com palavras-chave na busca.
  - A lista tem "Meus personagens", "Da mesa" (de quem é) e a lixeira com Restaurar. O estado mostra Rascunho, Publicado ou Alterações não publicadas.
  - O editor tem nome, nível e Detalhes, além de mandar para a lixeira. O personagem de outra pessoa abre somente leitura, com `ReadOnlyTheme`.
  - O `useBuild` salva 1,5 s depois da última mudança e guarda o rascunho local por mesa. Ele reenvia quando a rede volta e abre o diálogo de conflito no 409.
  - Conferido no navegador em 320 px e no desktop. Digitar mudou o estado para "Salvo" e o servidor recebeu o `rev` 2. Uma gravação concorrente abriu o diálogo de conflito.
  - **Fora da F2.** O retrato no cartão espera os detalhes chegarem ao cabeçalho da lista (F8, com o portrait). "Importar do Pathbuilder" é da F7.
- **2.11** Seção "Criação de personagem" em `/mesa`, em chunk próprio. Tem as variantes, a raridade, o nível e a riqueza inicial, além dos livros com filtro e o conteúdo legado. Variantes que o motor ainda não calcula (ABP, PwL, Dual Class e Gradual Boosts) podem ser ligadas, com a nota de que saem com aviso.
- **2.12** O `check-auth` cobre criar, salvar com `rev`, 409, 403 para build alheio, leitura somente leitura e lista sem `state`. Cobre também GM gravando e atribuindo dono, 413, lixeira e regras da mesa: GM real exigido inclusive com a cobrança desligada. Tudo certo, sem sobra de dados de teste.
- **Verificação.** Build, lint, `check-builder`, `check-auth` e `check-migrations` passaram. Nada do Criador entrou no bundle principal.
- **Próximo passo.** F3 (origem, classe nível 1, atributos e perícias) e F1B (atualização da base pela plataforma). A F3 depende de F1 e F2, ambas prontas.

## F1B — Atualização da base pela plataforma concluída (exceto 1B.10, opcional)

- **Núcleo em `api/_lib/rules-platform.js`.** Verificar, importar em passos e publicar. O `import-rules.mjs` passou a usar os mesmos passos sem prazo, então só existe uma lógica de importação.
  - **Verificar novidades.** Os livros vêm em 4 páginas da AON e a contagem por livro numa agregação só, em ~4 s. Um livro importado vira "errata nova" (`status = 'outdated'`) quando o texto da errata ou a contagem na AON muda. Primeira verificação em produção: 161 importados, 137 legados, 45 sem conteúdo de jogador e nada novo.
  - **Importar.** O passo lê páginas por até 35 s e grava o cursor a cada página; o navegador repete até acabar. Reimportar Wake the Dead #5 pela API de passos deu 0 alteradas e nenhuma versão nova.
  - **Publicar.** Montar os 322 pacotes leva ~2 s. Só as listas com hash novo são gravadas; as outras são copiadas da versão anterior (16 por vez). Teste em produção: a versão `2026.11.3`, idêntica à `2026.11.2`, copiou 321 listas em 20 s, com 8 por vez na época.
  - **Decisão: o Foundry fica só no script.** A mecânica do Foundry precisa do tarball fixado e não roda na Vercel. Pela tela, as entradas novas entram com a mecânica derivada da própria AON; o relatório conta as "sem mecânica". O admin preenche o que faltar pela correção manual ou roda `--mechanics-only` quando o commit do Foundry subir. As tabelas curadas vêm da versão anterior.
- **Rotas de admin em `rules-handler.js`.** Ficam no `state`, antes do Criador, e são só para `platform_admins`. Um passo por vez usa a trava `rules-import:<job>`. Falha da AON ou do Storage devolve 502 e o job segue com o cursor salvo.
- **1B.7 Correção manual de mecânica.** Exige a referência (livro e página) e grava `origin = 'manual'` com `reviewed`; o Foundry não passa mais por cima. Para chegar ao Criador, a tela tem "Publicar versão nova".
  - **Migrations.** A `correcao_manual_de_mecanica` foi aplicada **vazia**: o comando que a escrevia foi interrompido. Como migration aplicada não se edita, as colunas `note` e `updated_by` vieram na `nota_da_correcao_de_mecanica`.
- **1B.8 Verificação semanal.** O cron diário do `/api/health` verifica de novo quando a última verificação tem mais de 7 dias. Ela nunca importa sozinha. O aviso ao admin é o selo "N novidades" no item Base de regras (`?me=1` traz `platformAdmin` e `rulesNews`), em vez de notificação de mesa, porque a base não é de mesa nenhuma.
- **1B.6 Tela `/plataforma/regras`.** Fica em chunk próprio, com item só para admin na seção MESA, visível em qualquer mesa e com qualquer papel.
  - Mostra a versão, as entradas e quando foi a última verificação. Tem filtros por estado e linha de produto, busca, seleção, barra de progresso com "Continuar" e "Cancelar", o relatório das últimas importações e o editor de mecânica.
  - Conferida em 320 px e no desktop, com a resposta da API real interceptada no navegador de teste, porque o modo local não tem login.
- **1B.9 Faixa "Regras atualizadas" no editor.** Aparece quando a `rulesVersion` do build difere da atual. "Usar as novas" atualiza o build. O "N números mudaram" depende do motor (F3+).
- **1B.11.** O `check-auth` confere que jogador e GM comum recebem 403 em todas as rotas de admin, também com a cobrança desligada, e que o `?me=1` deles não traz `platformAdmin`.
- **Fora.** 1B.10 (pré-traduzir um livro) é opcional e ficou para depois.
- **"Pronto quando" da F1B.** Reimportar sem mudança não altera nada (conferido). Importar um livro novo pela tela depende de a AON publicar um; hoje não há nenhum Remaster novo. Um livro legado importado pela tela entraria na base sem aparecer nas mesas, até o GM liberar.

## F3 — Origem, classe (nível 1), atributos e perícias concluída (falta a conferência M1 no Pathbuilder)

- **Regras conferidas na AON Remaster antes de codificar, com livro e página no código.** Os 🔎 de nível 1 do MOTOR viraram ✅:
  - Atributos: Player Core pg. 17 (boost, parcial em +4, grupos distintos), pg. 23 (boosts alternativos, flaws voluntários), pg. 84 (background) e pg. 92 (boosts a cada 5 níveis).
  - Perícias: Player Core pg. 225 e pg. 84 (treino repetido vira livre) e pg. 92 (aumentos e tetos). pg. 29: aumento de INT dá uma perícia e um idioma a mais.
  - Idiomas, Player Core pg. 89. Derivados: Player Core pg. 11 (proficiência), pg. 91 (PV), pg. 271 (CA), pg. 26 (salvaguardas), pg. 25 (Percepção) e pg. 27 (CD de classe).
  - As 29 classes Remaster da AON dizem "Trained in <classe> class DC".
- **Duas lacunas da derivação, achadas pelo motor e corrigidas na base.**
  - **Boosts do Humano e do Orc.** A AON escreve "Two free ability boosts", que se perdia. O Player Core foi reimportado pela plataforma: 2 alteradas, versão `2026.11.4`, 1 lista regravada e 320 copiadas, em 11 s. Foi o primeiro uso real da F1B.
  - **Ancestralidade da herança.** A AON não liga a herança à ancestralidade em campo nenhum. Ela veio do Foundry (`system.ancestry`), na coluna nova `rules_mechanics.extra` (migration `dados_extras_do_foundry`). Depois veio o `--mechanics-only`, que agora publica versão nova (`2026.11.5`) em vez de sobrescrever a atual, cujo caminho é imutável no CDN.
- **Motor em `engine/`** (`compile.ts`, `attributes.ts`, `skills.ts`, `types.ts`): TS puro, sem rede.
  - Calcula atributos com parciais e o `breakdown` do export, proficiências iniciais da classe, PV, CA sem armadura, salvaguardas, Percepção, CD de classe, deslocamento, tamanho e sentidos (inclusive o `Sense` da herança).
  - Calcula também as perícias: automáticas, escolha da classe, livres + INT + repetidas, Lore livre, perícia pela INT e aumentos com teto.
  - E os idiomas pela INT.
  - **Avisos.** Boost repetido ou fora das opções, flaw duplo, livro, legado e raridade pelas regras da mesa, herança de outra ancestralidade, efeito não calculado, escolha órfã com "descartar", PV de ancestralidade desconhecido. Acima do nível 1, avisa que as características de classe ainda não entram (F4).
- **`check-builder`: 105 conferências.**
  - Um Humano Guerreiro nível 1 com números tirados das regras: PV 20, CA 15, FORT/REF +7, VON +4, Percepção +6, CD 17.
  - Casos de borda e a herança vinda do Foundry.
  - **Atributos do elenco.** Ceros, Eldarion, Ghan Buri, Thalos e Woyd batem exatamente com o export do Pathbuilder, parciais incluídos. Brukuthur, Loki, Miranda e Nathaniel usam conteúdo legado. Hearts Folly tem atributos editados à mão (o export não traz a memória dos boosts).
- **Interface.**
  - O seletor (`ContentPicker`) tem busca, raridade, "só o liberado na mesa", ↑/↓/Enter, tela cheia no celular com detalhe em segunda camada e duas colunas no desktop. A descrição completa sai do pipeline de descrições, sob demanda.
  - Abas Origem (com idiomas, boosts alternativos e flaws voluntários), Classe (atributo-chave), Atributos (grupos com "Restam N") e Perícias (pips T/E/M/L, Lore livre).
  - Resumo fixo com a conta de cada número no `title`. Pendências e avisos ficam ao lado no desktop e numa gaveta no celular.
  - Conferido no navegador em 320 px e no desktop, com o catálogo real do Storage e builds em memória. Os números da tela batem com o caso do `check-builder`.
- **Decisões.**
  - Lista de livros da mesa vazia = sem restrição, para uma mesa nova não esconder o catálogo inteiro.
  - Heranças versáteis saem do seletor de ancestralidade.
  - Lista sem virtualização: a maior das listas da F3 tem ~300 itens. A virtualização entra com os talentos (F4), se medir lentidão.
- **Pendente.**
  - **3.10.** Os textos de tela são bilíngues. Os nomes do conteúdo (ancestralidades, classes) seguem em inglês canônico, como no export e na AON; a tradução desses nomes depende do pipeline de descrições.
  - **"Pronto quando" M1.** Criar um nível 1 de cada classe do elenco no Pathbuilder e comparar PV, CA, salvaguardas, Percepção e perícias. O gabarito automático cobre os atributos de 5 personagens e o Guerreiro calculado pelas regras; a conferência no Pathbuilder, pelo Brave, fica para a próxima sessão.
- **Próximo passo.** F4: progressão 1–20, talentos (com `ContentPicker` e pré-requisitos), características de classe por nível e as variantes (Free Archetype, Mítico, Ancestral Paragon).

## F4 — Progressão 1–20, talentos e variantes concluída (com pendências registradas)

- **Variantes conferidas na AON.** Free Archetype: GM Core pg. 84, um talento de arquétipo extra no 2º e em todo par. Mítico: War of Immortals pg. 77, talento mítico extra nos pares e destino obrigatório no 12º. Ancestry Paragon: Gamemastery Guide pg. 194, só legado — dois talentos de ancestralidade no 1º e um em cada ímpar. Arquétipo ocupa slot de classe e a trava da dedicação vêm do Player Core pg. 215. Combat Flexibility e Improved Flexibility: Player Core pg. 136. Path to Perfection: Player Core 2 pg. 114.
- **Achado sobre a semente das mesas.** O elenco usa o **talento geral** "Ancestral Paragon" (Thalos e Woyd, no 3º), não a variante Ancestry Paragon. Com a variante ligada, sobram slots de ancestralidade no 3/7/11… em todos os personagens. A semente de `mesa_rules` (F0.3) liga a variante nas duas mesas; **o GM deve desligá-la em `/mesa`** se a intenção era o talento. Não mudei a regra em produção porque foi decisão confirmada pelas mesas.
- **Proficiências por nível.** As regras do Foundry para "Fortitude Expertise", "Juggernaut" e afins vêm vazias. A fonte passou a ser o texto da AON, derivado em `classFeature.proficiencies` (`rules-derived.js`):
  - Formas aceitas: "proficiency rank for X increases to R", "…increases to R with X", "gain expert proficiency in X" e "become an expert in X".
  - Vão para `unsupported`: o que depende de escolha (grupo de arma, a salvaguarda escolhida), frase condicional ("If you have qi spells") e arma específica (armas de fogo, bombas).
  - Base reimportada inteira duas vezes pelo script: `2026.11.6` (279 alteradas) e `2026.11.7` (4 alteradas, Weapon Tricks e afins), ambas só com `core/class-features` regravada. Na segunda, o download do tarball do Foundry estourou o tempo; o loader passou a aceitar `FOUNDRY_TARBALL=<arquivo do mesmo commit>` e o limite subiu para 15 min.
- **Motor.** `slots.ts` (slots por nível, variantes e slots de característica), `feats.ts` (validações e efeitos), `prereqs.ts` (pré-requisitos por parte, `ok/fail/unknown`), `classChoices.ts` (subclasses e salvaguarda do Path to Perfection) e `rulesIndex.ts` (por id e por nome).
  - **Efeitos suportados.** `FlatModifier` sem predicado (Toughness, Fleet), `ActiveEffectLike` de rank com a escolha do `ChoiceSet` (Canny Acumen, Fighter), `ChoiceSet` (lista, perícias ou talento filtrado → slot filho) e `GrantItem` de talento.
  - **Concessões.** Talento do background e talentos concedidos por característica (Shield Block do Fighter).
  - **Avisos.** `LEVEL_TOO_LOW`, `WRONG_SLOT`, `DUPLICATE_FEAT`, `DEDICATION_LOCK`, `PREREQ_FAIL`/`PREREQ_UNKNOWN`, `UNSUPPORTED_EFFECT`, `UNSUPPORTED_CHOICE` e `SAVE_CHOICE_REPEAT`.
- **`check-builder`: 132 conferências.**
  - **M2.** Os slots de talento dos 10 personagens do elenco são iguais aos do Pathbuilder. Os talentos do export preenchem os slots sem pendência fantasma; 22 talentos legados ficam fora do recorte.
  - **Ghan Buri nível 10.** Percepção, salvaguardas, armas e armaduras iguais ao export.
  - **Comparação de proficiências sem talentos.** Sete das dez classes batem no nível atual, inclusive o Rogue (Weapon Tricks, "gain expert proficiency"). As três diferenças dependem de escolha: Monk (Path to Perfection), Investigator (o talento Canny Acumen) e Cleric (a doutrina, ainda com aviso).
- **Interface.** Aba Progressão com acordeão por nível (níveis futuros esmaecidos como "planejado") e o seletor de talentos: candidatos pelo tipo e pelo teto de nível, motivo de inelegibilidade na linha e no detalhe. Há ainda escolhas de classe, de salvaguarda e escolhas filhas (lista ou talento) e um navegador de arquétipo que baixa a lista dele. Conferida em 320 px e no desktop: Fighter 3 com Toughness dá PV 47, Vontade +8 (Bravery) e CD 19.
- **Também feitos.** `Sense`, `BaseSpeed` e `Resistance`/`Weakness`/`Immunity` fixos. Ancestralidade e herança passam pelo caminho dos talentos: Versatile Human abre o talento geral e Cavern Elf dá visão no escuro. O chamado mítico é escolha quando o personagem é mítico; no 12º, um aviso lembra que o talento mítico é o de destino.
- **Falta (fica para depois, com aviso no motor).**
  - **4.2:** `MartialProficiency` (armas de fogo do Gunslinger).
  - **4.3:** ikons, táticas, runas, aparições, lições e tese arcana têm contagem por conferir. A progressão da doutrina do Cleric ainda não é calculada.
  - **4.7:** qualificador de talento (Assurance (X)) e repetíveis pela regra do talento.
  - **4.8a:** conferir o traço dos talentos de destino (o aviso do 12º não confere o traço) e o mítico por personagem na tela.
- **Próximo passo.** F5: magias.

## F5 — Magias concluída (núcleo; pendências registradas)

- **Conjuração da classe derivada da AON** (`class.casting` em `rules-derived.js`).
  - Tradições vêm de `tradition_markdown`; mais de uma significa que a subclasse decide (Witch, Sorcerer, Summoner), e o jogador escolhe a tradição.
  - O tipo sai da seção "Spellcasting": "repertoire" é espontâneo, "prepare" é preparado.
  - O atributo sai da frase "spell DC use(s)/calculated using your X modifier"; o Magus conjura com INT, e o Psychic usa o atributo-chave.
  - O Animist mistura preparado e repertório: fica `mixed`, com aviso.
- **Motor** (`engine/spells.ts`).
  - Conjurador da classe: magias por dia pela tabela gerada da AON (`spellSlots`), proficiência inicial (`class.spellcasting`) com as subidas das características ("Expert Spellcaster"…), CD e ataque.
  - Escolhas: grimório (Wizard, Magus), preparadas com cópias e "Restam N" e repertório. O tamanho do repertório por rank ainda não é conferido e fica com aviso.
  - Validação de rank e tradição.
  - Foco: escolha do jogador na lista de foco, porque o Foundry quase nunca concede por regra. O pool é o número de magias de foco que gastam ponto, até 3 (Player Core pg. 298), e elas são lançadas na metade do nível.
  - Rituais.
- **Aba Magias.** Um cartão por conjurador (tradição, atributo, CD/ataque, magias por dia, grimório, ranks), mais foco e rituais. Conferida em 320 px e no desktop com um Magus 7: CD 21, ataque +11 e as magias por dia do Impossible Magic pg. 9.
- **Base reimportada** com `casting`: versão `2026.11.8` (12 classes alteradas, só `core/classes` regravada).
- **`check-builder`: 152 conferências.** Thalos (Psychic 10), Woyd (Cleric 7), Nathaniel (Magus 10) e Loki (Magus 7) batem em tradição, tipo, atributo e magias por dia. O Loki tem um truque a mais, que vem de talento. A proficiência bate em todos, menos no Woyd, porque segue a doutrina do Cleric. Pool de foco e tradição com maiúscula da AON também têm caso.
- **Pendente.**
  - Conjuradores de arquétipo (Basic/Expert/Master Spellcasting) e inatos: o Aeromancer, o Caster Arcane Sense e o Mythic Magic do elenco.
  - Magias concedidas por escolha (escola, domínio, mistério).
  - Tamanho do repertório espontâneo.
  - O truque extra do Loki, que vem de talento.

## F6 — Equipamento e companheiros concluída (núcleo; pendências registradas)

- **Regras conferidas na AON.**
  - Player Core: Volume (pg. 269, 5 + FOR e máximo 10 + FOR); moedas (pg. 269, mil = 1 Volume, arredondado para baixo); CA com teto de DES e Força da armadura (pg. 271); ataque e dano com acuidade, arremesso e propulsiva (pg. 275); riqueza inicial de 15 po (pg. 10).
  - GM Core: investidos até 10 (pg. 219), runas de armadura (pg. 226) e de arma (pg. 236).
  - Grupo de arma do Fighter Weapon Mastery e da Weapon Legend: Player Core pg. 136. Especialização em armas, 2/3/4 e na versão maior 4/6/8: texto das características na AON.
- **Motor (`engine/equipment.ts`).**
  - Itens resolvidos pelo catálogo (o item específico usa os números da base); preço, compras e sobra; Volume com moedas; investidos.
  - Armadura vestida: CA, teto de DES, Força, penalidades. O escudo fica fora da CA, como no export. O resiliente entra nas salvaguardas.
  - Golpes das armas e o punho do catálogo: ataque, dados com striking, dano com FOR/propulsiva/especialização e overrides com aviso.
  - **Avisos.** `ENCUMBERED`, `OVER_BULK`, `INVESTED_LIMIT`, `NEGATIVE_MONEY`, `RUNE_SLOTS`, `SPECIFIC_ITEM` e `WEAPON_OVERRIDE`. Dano extra de runas de propriedade sai como "efeito não calculado".
  - A escolha de grupo de arma é calculada e aparece na aba Progressão.
- **Livro de fórmulas:** campo novo `formulas` no `BuildState`, nos dois sanitizadores, com caso no par cliente × servidor.
- **Companheiros:** companheiro animal (tipo, avanço e especialização do catálogo) e familiar (específico e habilidades). Os números continuam com a Ficha (`companionStats.ts`). O número de habilidades do familiar ainda não é conferido.
- **Aba Equipamento:**
  - Dinheiro, com a referência de riqueza (15 po no nível 1; acima, a tabela do GM Core pg. 61).
  - Inventário por categoria, com quantidade, origem (comprado/ganho), vestido/investido e o diálogo de runas.
  - Golpes com a conta no `title`, livro de fórmulas e companheiros.
  - Conferida em 320 px e no desktop com o catálogo real: Fighter 10 com CA 29 e deslocamento 20 (Full Plate com a Força atendida).
- **`check-builder`: 164 conferências.** Ghan Buri: Warhammer com ataque +23, dano +8 e 2d8; CA 29 com o Hero's Plate +1; resiliente +1; escudo de 3 fora da CA; punho. Também: carga, dinheiro negativo e o Volume das moedas. O recorte passou a incluir a base dos itens específicos e o punho.
- **Pendente.**
  - Dano extra das runas de propriedade (o dado de runa não está no catálogo).
  - Materiais além do rótulo; contêineres (capacidade).
  - Penalidade de teste da armadura nas perícias; Adventurer's Kit separado.
  - Arachnid Harness e o companheiro do Ardagar, que ficam para a paridade da F7.

## F7 — Modo editar, aplicar na mesa e importação concluída (beta; pendências registradas)

- **Retrato (`engine/export.ts`).** É o `BuildInfo` completo do CONTRATO-FICHA:
  - Identidade, atributos com o `breakdown`, proficiências sem nível, talentos em tupla com o rótulo do slot do Pathbuilder, `specials` (com Path to Perfection e a escolha).
  - Armas sem o punho (a Ficha já soma o dela), armaduras e escudos, equipamento, dinheiro depois das compras.
  - Conjuradores com grimório e preparadas, foco, rituais, companheiros e familiares, `acTotal`, `mods`, resistências e fórmulas.
  - Extensões em `build.covil`: `buildId`, avisos, ids das escolhas, variantes, chamado mítico e o punho em `unarmed`.
- **Importação (`engine/import.ts`).**
  - Origem, boosts (alternativos e flaws), idiomas e talentos pelo rótulo do slot; filhos pelo `ChoiceSet` do pai; Path to Perfection pelo nome; grupo de arma pela proficiência específica.
  - Perícias: as automáticas, depois as livres, depois os aumentos do nível mais baixo, respeitando os tetos.
  - Inventário com runas, magias da classe (repertório, grimório e preparadas), foco, rituais e companheiros.
  - Relatório do que não casou.
- **Paridade (PLANO §1.1) no `check-builder`: 214 conferências.** Os 10 personagens fazem importar → recompilar → exportar.
  - Invariantes: `parseCharacterJson` aceita o retrato, até 64 KB, CA = 10 + partes.
  - Diferenças: o **Ghan Buri não tem nenhuma**. As outras 71 estão em `scripts/rules-data/parity-known.json`, cada uma com a explicação: conteúdo legado ou caseiro fora do catálogo Remaster, ranks de perícia vindos de talentos que o motor não modela (Additional Lore, por exemplo), conjuradores de arquétipo e inatos, doutrina do Cleric, truque extra de talento.
  - Diferença nova faz o teste falhar.
- **Servidor.**
  - `build-apply` (dono ou GM) usa o slug estável do build e o mesmo preparo da publicação: `createSheetDraftFor`, extraído do `draft-create`.
  - Ao fim do preparo, liga `sheets.build_id`, grava `character_build_versions` e marca `published_rev`.
  - Também: `?buildVersions=`, `build-version-restore` e `build-create` com `fromSheet` (herda o slug da ficha; só o dono da ficha ou o GM).
  - O `check-auth` cobre: aplicar com o nome trocado mantém o slug; o colega leva 403 ao aplicar e ao ler as versões.
- **Cliente.**
  - "Aplicar na mesa" (avisos e pendências antes, preparo com progresso, "Abrir na Ficha"), "Baixar JSON" (backup) e "Versões" com restaurar.
  - Na Ficha: "Editar no Criador", quando há `covil.buildId`, ou "Importar para o Criador" na ficha publicada. Só para quem edita e fora do painel do mapa.
  - A importação (`/personagens?importar=<slug>`) carrega as listas que a ficha usa, importa e cria o build com o mesmo slug; se já existe, só abre. A ficha da mesa não muda até aplicar.
- **Decisões.**
  - O modo editar abre na rota do Criador (`/personagens/:id`), em vez de embutido na Ficha em `?modo=editar`: mesmo efeito, sem pôr o Criador no chunk da Ficha. Embutir fica para a F8.
  - O punho não vai em `weapons[]`, porque a Ficha soma o próprio (`unarmed.ts`); vai em `covil.unarmed`.
- **Pendente.**
  - **7.8:** a Ficha ler `covil.unarmed` no lugar do `unarmed.ts`, com casos no `check-rolls`.
  - "Subir de nível" e "Trocar talento" a partir da Ficha.
  - `sheetDiff` no diálogo de aplicar.
  - Aceite M3 com o GM e um jogador de cada mesa, que precisa de pessoas.
