-- Descrições também em INGLÊS: a conta pode usar a plataforma em inglês, e aí a
-- descrição é o texto da AON como está, sem passar pela tradução. As duas versões
-- moram na mesma tabela global, separadas pela coluna `lang`; tudo o que já existe
-- é português.
--
-- A lista de nomes de cada ficha (`sheet_description_sets`) e os misses
-- (`description_misses`) não mudam: o nome que a ficha descreve e o que a AON não
-- acha são os mesmos nos dois idiomas.

alter table public.descriptions
    add column lang text not null default 'pt' check (lang in ('pt', 'en'));

alter table public.descriptions drop constraint descriptions_pkey;
alter table public.descriptions add primary key (version, lang, kind, name);

-- O pacote da ficha publicada num idioma. Função NOVA (3 argumentos, sem padrão),
-- para não ficar ambígua com a de 2, que o código em produção ainda chama.
create function public.sheet_descriptions(p_mesa text, p_slug text, p_lang text)
returns jsonb
language sql
stable
set search_path = ''
as $$
    select jsonb_build_object(
        'version', s.version,
        'lang', p_lang,
        'entries', (
            select jsonb_object_agg(k.kind, coalesce((
                select jsonb_object_agg(d.name, d.payload)
                from public.descriptions d
                where d.version = s.version
                  and d.lang = p_lang
                  and d.kind = k.kind
                  and d.name in (select jsonb_array_elements_text(coalesce(s.names -> k.kind, '[]'::jsonb)))
            ), '{}'::jsonb))
            from unnest(array['spell', 'feat', 'special', 'item']) as k (kind)
        ),
        'misses', (
            select jsonb_object_agg(k.kind, coalesce((
                select jsonb_object_agg(m.name, floor(extract(epoch from m.missed_at) * 1000)::bigint)
                from public.description_misses m
                where m.kind = k.kind
                  and m.missed_at > now() - interval '24 hours'
                  and m.name in (select jsonb_array_elements_text(coalesce(s.names -> k.kind, '[]'::jsonb)))
            ), '{}'::jsonb))
            from unnest(array['spell', 'feat', 'special', 'item']) as k (kind)
        )
    )
    from public.sheet_description_sets s
    where s.mesa = p_mesa and s.slug = p_slug
$$;

-- A de 2 argumentos passa a ser só o português. Sem o filtro, as linhas em inglês
-- entrariam no mesmo `jsonb_object_agg` por nome e uma das duas venceria ao acaso.
create or replace function public.sheet_descriptions(p_mesa text, p_slug text)
returns jsonb
language sql
stable
set search_path = ''
as $$
    select public.sheet_descriptions(p_mesa, p_slug, 'pt') - 'lang'
$$;

revoke all on function public.sheet_descriptions(text, text, text) from public, anon, authenticated;
grant execute on function public.sheet_descriptions(text, text, text) to service_role;
