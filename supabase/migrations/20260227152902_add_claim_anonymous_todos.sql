-- Migrate todos from an anonymous session to the now-authenticated user.
-- Uses security definer so it can update across user_id boundaries.
-- Validates the caller is a non-anonymous authenticated user.
create or replace function claim_anonymous_todos(anon_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only run if the caller is an authenticated, non-anonymous user
  if auth.uid() is null or auth.uid() = anon_user_id then
    return;
  end if;

  update todos
  set user_id = auth.uid()
  where user_id = anon_user_id;
end;
$$;
