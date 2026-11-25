-- Criador de Personagem (F8.8): aviso em tempo real quando um build muda, no canal `mesa:<mesa>:builds`. Só o aviso
-- (id, rev, quem): as escolhas não vão no canal da mesa inteira; quem precisa relê pela API, que confere o acesso.
create function public.broadcast_builds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform realtime.send(
        jsonb_build_object('buildId', new.id, 'rev', new.rev, 'by', new.updated_by),
        'builds', 'mesa:' || new.mesa || ':builds', true);
    return null;
end
$$;

revoke all on function public.broadcast_builds() from public, anon, authenticated;

create trigger character_builds_broadcast after insert or update on public.character_builds
    for each row execute function public.broadcast_builds();
