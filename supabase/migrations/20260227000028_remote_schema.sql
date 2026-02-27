create table public.todos (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  completed boolean default false not null,
  created_at timestamptz default now() not null
);

alter table public.todos enable row level security;

create policy "anon_all" on public.todos
  for all
  to anon
  using (true)
  with check (true);
