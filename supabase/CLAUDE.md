# Supabase (banco, migrations, Realtime, Storage)

Toda a persistência: Postgres (estado da mesa, fichas e histórico, descrições, traduções, correções, feed, mapas,
encontros, diário, wiki, notas, troféus), Realtime e Storage (bucket `images`). Projeto `htgrzvdzxepbbgbaqkir`, `sa-east-1`.
O Redis e o Vercel Blob saíram; os stores do servidor mantiveram as mesmas funções exportadas.

## Migrations

- Crie com `npx supabase migration new <nome>`. Não há Docker nem branch de preview (decisão do usuário / plano gratuito).
- **Antes do commit**: `node --env-file=.env scripts/check-migrations.mjs` (roda as pendentes em produção em `BEGIN…ROLLBACK`).
- **Depois do push**: `npx supabase migration list`. A integração com o GitHub às vezes não aplica; se seguir pendente,
  `npx supabase db push` com o `.env` carregado (o usuário autorizou fazer isso direto).
- **Nunca edite uma migration já aplicada** — crie outra.
- **Toda migration faz os `grant`** do que usa: o projeto não expõe tabelas novas e tem RLS automático (`ensure_rls`), então
  tabela nova não dá privilégio a ninguém, nem ao `service_role`.
- Listas espelhadas que exigem migration ao mudar: CHECK de campos de `character_state` (↔ `FIELD_RE`), linhas de `mesas`
  (↔ `MESA_IDS`/`MESAS`), CHECK de `kind` em `aon_lookups` (`letras:vN`).

## Realtime

- **Só o banco transmite**: trigger → `realtime.send` no canal privado `mesa:<mesa>:<nome>` (`state`, `rolls`, `map:<id>`,
  `maps`, `encounters`, `fixes`, `sheets` — também `preparing`/`prepared` —, `events`, `journal`, `wiki`, `notes`). Só quem
  está em `mesa_members` ouve (RLS em `realtime.messages`).
- Exceções do cliente, liberadas por política de insert só nesses tópicos: Presence em `mesa:<mesa>:presence` (extensão
  `presence`) e Broadcast em `mesa:<mesa>:live:<mapa>` (extensão `broadcast`). Qualquer outro envio do cliente é recusado.
- Payload de aviso de conteúdo secreto (diário, wiki, notas, encontro grande) leva só id/`updatedAt`/`by`; quem ouve relê pela API.

## Storage (bucket público `images`)

- Insert só para membro da mesa, só arquivo NOVO, nome `[a-z0-9-]` com extensão de imagem, nas pastas `tokens/`, `maps/`,
  `monsters/`, `items/`, `wiki/` (qualquer membro) e `journal/` (só `gm`). Sem update nem delete: apagar é do servidor.
- Até 8 MB, só WebP/PNG/JPEG. O upload vai direto do navegador (passar pela função esbarraria nos 4,5 MB do corpo).

## Operação

- **Pausa por inatividade** (7 dias, plano gratuito): o cron do `vercel.json` chama `/api/health` diariamente.
- **`pg_cron`** limpa: anônimos inativos há 180 dias, travas vencidas, misses velhos, `shares` de mais de um dia, estado de
  personagem parado há 180 dias, `mesa_events` de mais de 30 dias, rascunhos de publicação parados há 14 dias.
- **Backup**: `.github/workflows/backup-supabase.yml`, semanal, **criptografado** (repositório público: artefato é
  baixável). Sem `BACKUP_PASSPHRASE` o workflow falha em vez de publicar aberto.
- **Conexão direta**: `db.<ref>.supabase.co` é só IPv6; fora daqui use o pooler em modo sessão,
  `aws-1-sa-east-1.pooler.supabase.com:5432` (o `aws-0` recusa). A CLI mascara a chave secreta sem `--reveal`.
- O `.env` local tem as chaves de **produção**: teste na mesa `arton-1515` com slugs `teste-*` e apague.
