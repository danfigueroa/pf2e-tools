# Troféus do Covil (`/trofeus/:user?`, `src/modules/trophies/`; servidor em `api/_lib/trophies.js`, `trophy-store.js`, `trophy-handler.js`)

Gamificação estilo PSN/Xbox. Decisões do usuário: **global por conta** (soma as mesas; o troféu guarda onde foi ganho), a
mesa vê tudo + ranking, **todo mundo do zero** (nada retroativo), **o GM tem conjunto e ranking próprios**.

- **Catálogo num lugar só** (`TROPHIES` em `trophies.js`: id, papel, categoria, grau, título, descrição, `goal`,
  `measure(facts)`). O GET devolve o catálogo; o cliente não repete a lista. **Troféu novo = entrada lá** (+ o feito no handler
  certo e a conta em `deriveFacts`/`trophy_facts` se precisar de fato novo) + entrada em `trophies-en.js` + caso no `check-trophies`.
- **Ranking pelo papel na mesa**: cada pessoa numa lista só (GM em "Mestres", o resto em "Jogadores"), mesmo com pontos
  do outro papel — os pontos são globais e apareceriam em dobro.
- Pontos: bronze 15, prata 30, ouro 90, platina 300; platina = todos os outros do papel. Nível do perfil: `levelOf`.
- **Todo troféu não ganho é secreto** (decisão do usuário): `catalogWire(unlocked, lang)` mascara **no servidor** título,
  descrição e meta; `trophyProfile` só devolve progresso dos ganhos. Esconder só na tela vazaria pela aba Rede.
- **Fatos** de `trophy_feats` (registro de feitos), `mesa_sessions` (janelas de sessão) e rolagens `in_session` dentro de uma
  janela pela ficha que a pessoa possui; `trophy_facts(user)` junta numa consulta. "Seguidos" é dentro da mesma sessão;
  madrugada = 0h–5h de Brasília. `account_trophies` (PK `user_id, trophy_id`) torna o desbloqueio idempotente.
- **Quem registra é o servidor**, no handler que já conhece o usuário (`recordFeat`/`touchFeat`), **sempre dentro de
  `safely`** — troféu nunca derruba a ação. Feito de jogador só vale para o **dono** da ficha (`ownerOf`). `touchFeat` junta
  rajadas (autosave) numa janela de 30 min e só reavalia se algo que o catálogo lê mudou. Combate iniciado vem de trigger
  (`encounter_trophy_feat`).
- **Sessão** (`mesa-settings`): iniciar abre `mesa_sessions` (e fecha alguma esquecida); encerrar fecha, roda
  `session_rollup`, elege destaques (`sessionHighlights`, **empate não elege**) e avalia todos os membros.
- `evaluate` roda depois de cada feito e no `GET ?trophies=me`; o novo vira `mesa_events` `trophy-unlocked` (`data: { user,
  name, trophy, title, titleEn, description, descriptionEn, tier, category }`). O aviso mostra a descrição (o que
  desbloqueou); ela não vaza, porque quem ganhou já a mostra no próprio perfil. Evento antigo vem sem descrição e sem
  categoria: a linha some e a medalha cai na taça. `GET ?trophies=summary` é o resumo leve da sidebar e da Início (sem avaliar).
- **Medalha** (`TrophyMedal`, SVG): a **silhueta é do grau** (bronze disco, prata escudo, ouro selo raiado, platina estrela) e o
  **glifo é da categoria** (`glyphs.ts`; sem categoria, a taça). **Categoria nova no catálogo = glifo novo** (o `check-trophies`
  cobra). O bloqueado não leva glifo (não dá pista do secreto). Cores em `TROPHY_TIERS` (`palette.ts`): `medal`/`hi`/`lo`/
  `engrave` são o metal (fixos nos dois temas), `ink` (≥4,5:1) e `tint` são do tema. Grau também por extenso: forma e cor não bastam.
- **O desbloqueio tem dois formatos** (`TrophyToastLayer`, em fila, os dois em chunks ociosos):
  - **Cerimônia em tela cheia** (`TrophyCeremony`): o troféu DESTA conta e o ouro/platina de um colega (mais curta). Véu,
    raios, medalha grande, confete num **`<canvas>` único** (`Sparks`, nunca um elemento por partícula), pontos e — no meu,
    ao vivo — a barra do nível enchendo, com a subida de nível se houver (`pointsBefore` = o resumo de antes do evento).
  - **Faixa no topo** (`TrophyUnlockCard`): bronze/prata de colega, **e qualquer troféu quando o foco está num campo de
    texto** (a cerimônia taparia o que a pessoa digita; autosave do background desbloqueia troféu no meio da frase).
  - **A cerimônia não rouba o foco nem trava nada**: fecha no toque, no Esc ou no tempo, e o troféu já está gravado.
  - **Sem som nem vibração** (decisão do usuário): o desbloqueio é só visual.
- **O MEU troféu vem da lista do sino, não do canal ao vivo** (`subscribeNotifications`): assim o ganho com o app fechado
  é celebrado na próxima abertura. A marca do já celebrado é `pf2e:trophies:celebrated:<userId>` **com `mesaKey`** (o id é
  o do evento da mesa); sem marca (primeira vez no aparelho) só se grava o topo. Mais de 3 de uma vez = uma cerimônia só.
- Em dev, `__trophy({ tier, category, who, pointsBefore })` no console mostra o aviso sem tocar no banco.
- **Animações** (`motion.ts`, sem biblioteca; movimento reduzido = direto). Página: cascata (`useInView` + `reveal`),
  contadores, barras por `scaleX`, anel do nível (`LevelRing`, também na Início), "Novo!" pelo `pf2e:trophies:seen:<userId>`
  (a primeira visita não marca), tocar num troféu ganho revê a cerimônia.
- **Ranking** (`Ranking.tsx`, aba "A mesa"): uma arena por papel — palco escuro com pódio (holofote, coroa, colunas de
  metal, confete ao aparecer), a frase da disputa (`chase`: quanto falta para alcançar quem está na frente) e a lista por
  FLIP. **Empate divide o lugar** (dois "1º", o próximo é o 3º). **Quem não pontuou não sobe em degrau**: o lugar fica
  "vago", à vista, para alguém tomar. Menos de 3 pessoas na lista = sem pódio.
- **Feitos da Wiki carregam o tipo da página** (`data.kind`): `wiki-created` (+ `parent`, `links`), `wiki-edited` e `wiki-read`
  (primeira leitura de página de outra pessoa, uma por conta+mesa+página). `factsOf` lê essas linhas cruas (`WIKI_FEATS`) e
  `deriveFacts` conta **por página**, não por registro; tipo por tipo em `WIKI_KINDS` ("Outro" não tem troféu). Sem migration:
  o `trophy_facts` não os resume. GM: `gm-wiki-reveal` (página só-GM revelada), `gm-wiki-secret` (página com `:::mestre`).
- Falta: casos de troféu no `check-auth`.
