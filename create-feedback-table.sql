-- Create feedback table
create table if not exists public.feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  page text not null,
  message text not null,
  resolved boolean default false not null,
  created_at timestamptz default now() not null
);

-- Index for admin queries
create index if not exists feedback_created_at_idx on public.feedback(created_at desc);
create index if not exists feedback_user_id_idx on public.feedback(user_id);

-- RLS
alter table public.feedback enable row level security;

-- Users can insert their own feedback
create policy "Users can insert feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- Only the admin can read all feedback
create policy "Admin can read all feedback"
  on public.feedback for select
  using (
    (auth.jwt() ->> 'email') = 'marius.r.hesby@gmail.com'
  );

-- Admin can update (mark resolved)
create policy "Admin can update feedback"
  on public.feedback for update
  using (
    (auth.jwt() ->> 'email') = 'marius.r.hesby@gmail.com'
  );
