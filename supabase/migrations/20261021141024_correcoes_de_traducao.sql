-- Correção de tradução pela mesa: a palavra mal traduzida é consertada uma vez,
-- para todo mundo, e o LLM nunca a desfaz.
--
-- A tradução de uma descrição chega por quatro caminhos — o pacote estático do
-- repositório, o pacote da ficha publicada, a API e o cache de cada aparelho —, e
-- consertar só o cache de traduções (`translations`) deixaria os outros três com o
-- erro. Por isso a correção é uma CAMADA por cima, por (tipo, nome), que o cliente
-- aplica na hora de ler, venha a descrição de onde vier.
--
-- Global, como as traduções: a Heal corrigida pela Casa do Gordo serve à Arton.
-- Sem login, qualquer um corrige; a salvaguarda é `previous` (a versão de antes da
-- última mudança, que o "Desfazer" devolve) e a origem a um toque ("Voltar à
-- tradução automática" grava `fields` vazio, e o anterior continua em `previous`).

create table public.description_fixes (
    kind text not null check (kind in ('feat', 'special', 'item', 'spell')),
    name text not null check (char_length(name) between 1 and 200),
    -- Só os textos corrigidos (`description`, `trigger`…). `{}` = sem correção.
    fields jsonb not null check (jsonb_typeof(fields) = 'object' and octet_length(fields::text) <= 16384),
    previous jsonb check (previous is null or octet_length(previous::text) <= 16384),
    -- Milissegundos, do servidor.
    updated_at bigint not null,
    updated_by uuid references auth.users (id) on delete set null,
    primary key (kind, name)
);

alter table public.description_fixes enable row level security;
grant select, insert, update, delete on public.description_fixes to service_role;

-- A correção vale para todas as mesas, mas os canais são por mesa (é o que o RLS de
-- `realtime.messages` libera): o aviso vai para o `fixes` de cada uma.
create function public.broadcast_description_fix()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_mesa text;
begin
    for v_mesa in select id from public.mesas loop
        perform realtime.send(
            jsonb_build_object('kind', new.kind, 'name', new.name, 'fields', new.fields,
                'previous', new.previous, 'updatedAt', new.updated_at),
            'fix',
            'mesa:' || v_mesa || ':fixes',
            true
        );
    end loop;
    return null;
end
$$;

revoke all on function public.broadcast_description_fix() from public, anon, authenticated;

create trigger description_fixes_broadcast after insert or update on public.description_fixes
    for each row execute function public.broadcast_description_fix();
