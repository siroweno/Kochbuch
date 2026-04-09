alter table public.user_week_plan
add column if not exists checked_items jsonb not null default '[]'::jsonb;
