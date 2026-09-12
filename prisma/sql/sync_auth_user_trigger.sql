-- Run this once in the Supabase SQL editor (or `supabase db execute`) against
-- the project's Postgres instance. This is NOT run by Prisma migrate, because
-- it creates a trigger on Supabase's own `auth.users` table, which Prisma does
-- not manage.
--
-- Effect: whenever Supabase Auth creates a row in auth.users (i.e. on sign up,
-- for any provider), a matching row is created in public."User" with role
-- defaulting to CUSTOMER. This runs inside Postgres as the definer, so it
-- cannot be skipped or spoofed by client-side code.
--
-- Prerequisite: run `prisma migrate dev` / `prisma db push` first so
-- public."User" exists.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public."User" (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    'CUSTOMER'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
