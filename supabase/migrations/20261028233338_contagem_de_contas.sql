-- Quantas CONTAS cada mesa de uma pessoa tem ("5 membros", no cartão da mesa da sidebar).
-- `mesa_members` ainda guarda as sessões anônimas de antes do login (somem no cutover), e
-- `auth.users` não é alcançável pelo cliente REST — daí a função.

create function public.mesa_account_counts(p_user uuid)
returns table (o_mesa text, o_accounts bigint)
language sql
stable
security definer
set search_path = ''
as $$
    select mm.mesa, count(*) filter (where not coalesce(u.is_anonymous, false))
    from public.mesa_members mm
    join auth.users u on u.id = mm.user_id
    where mm.mesa in (select mesa from public.mesa_members where user_id = p_user)
    group by mm.mesa
$$;

revoke all on function public.mesa_account_counts(uuid) from public, anon, authenticated;
grant execute on function public.mesa_account_counts(uuid) to service_role;
