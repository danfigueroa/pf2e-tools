# Troféus do Covil (`/trofeus/:user?`, `src/modules/trophies/`; servidor em `api/_lib/trophies.js`, `trophy-store.js`, `trophy-handler.js`)

Gamificação estilo PSN/Xbox. Decisões do usuário: **global por conta** (soma as mesas; o troféu guarda onde foi ganho), a
mesa vê tudo + ranking, **todo mundo do zero** (nada retroativo), **o GM tem conjunto e ranking próprios**.

- **Catálogo num lugar só** (`TROPHIES` em `trophies.js`: id, papel, categoria, grau, título, descrição, `goal`,
  `measure(facts)`). O GET devolve o catálogo; o cliente não repete a lista. **Troféu novo = entrada lá** (+ o feito no handler
  certo e a conta em `deriveFacts`/`trophy_facts` se precisar de fato novo) + entrada em `trophies-en.js` + caso no `check-trophies`.
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
  name, trophy, title, titleEn, tier }`). `GET ?trophies=summary` é o resumo leve da sidebar e da Início (sem avaliar).
- Cores em `TROPHY_TIERS` (`palette.ts`): `medal` (fixa), `ink` (≥4,5:1), `tint`. Taça em SVG (`TrophyMedal`); grau também por extenso.
- **Animações** (`motion.ts`, sem biblioteca; movimento reduzido = direto): o `TrophyUnlockCard` (chunk ocioso do
  `TrophyToastLayer`, a toda a mesa, em fila, 6 s; platina 10 s) com faíscas num **`<canvas>` único** (`Sparks`, nunca um
  elemento por faísca). Página: cascata (`useInView` + `reveal`), contadores, barras por `scaleX`, "Novo!" pelo
  `pf2e:trophies:seen:<userId>` (a primeira visita não marca). Ranking por FLIP.
- Falta: casos de troféu no `check-auth`.
