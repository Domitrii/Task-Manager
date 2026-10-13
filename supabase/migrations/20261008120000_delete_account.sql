-- Lets people delete their own account from their profile.
--
-- The team and its records stay for everyone else in it. An owner hands the
-- team to whoever has been in it longest first, exactly as when leaving.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;
  perform public.leave_team();
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
