-- ==============================================
-- GhostStudio – Supabase Schema + RLS Policies
-- Run this in your Supabase SQL editor
-- ==============================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------
-- WORKSPACES (one per Supabase auth user)
-- -----------------------------------------------
create table if not exists workspaces (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  name            text not null default 'My Workspace',
  gemini_api_key  text,
  role            text not null default 'user' check (role in ('user', 'admin')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table workspaces enable row level security;

create policy "workspace_select" on workspaces
  for select using (auth.uid() = user_id);

create policy "workspace_insert" on workspaces
  for insert with check (auth.uid() = user_id);

create policy "workspace_update" on workspaces
  for update using (auth.uid() = user_id);

-- Admin can read ALL workspaces
create policy "workspace_admin_select" on workspaces
  for select using (
    exists (select 1 from workspaces w where w.user_id = auth.uid() and w.role = 'admin')
  );

-- -----------------------------------------------
-- PROJECTS
-- -----------------------------------------------
create table if not exists projects (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  status          text not null default 'pending'
                    check (status in ('pending','processing','completed','failed')),
  input_images    text[] not null default '{}',
  output_image    text,
  prompt_used     text,
  model_used      text not null default 'gemini-2.5-flash-image',
  input_tokens    integer,
  output_tokens   integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table projects enable row level security;

create policy "project_select" on projects
  for select using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
  );

create policy "project_insert" on projects
  for insert with check (
    workspace_id in (select id from workspaces where user_id = auth.uid())
  );

create policy "project_update" on projects
  for update using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
  );

create policy "project_delete" on projects
  for delete using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
  );

-- Admin can read ALL projects
create policy "project_admin_select" on projects
  for select using (
    exists (select 1 from workspaces w where w.user_id = auth.uid() and w.role = 'admin')
  );

-- -----------------------------------------------
-- PROJECT VERSIONS (modification log)
-- -----------------------------------------------
create table if not exists project_versions (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  version_number  int not null default 1,
  output_image    text not null,
  feedback        text,
  created_by      text not null default 'user' check (created_by in ('user', 'ai')),
  description     text not null default 'Initial generation',
  created_at      timestamptz not null default now()
);

alter table project_versions enable row level security;

create policy "version_select" on project_versions
  for select using (
    project_id in (
      select p.id from projects p
      join workspaces w on p.workspace_id = w.id
      where w.user_id = auth.uid()
    )
  );

create policy "version_insert" on project_versions
  for insert with check (
    project_id in (
      select p.id from projects p
      join workspaces w on p.workspace_id = w.id
      where w.user_id = auth.uid()
    )
  );

-- -----------------------------------------------
-- CHAT MESSAGES (for Orchestrator Agent)
-- -----------------------------------------------
create table if not exists chat_messages (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  project_id      uuid references projects(id) on delete set null,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

alter table chat_messages enable row level security;

create policy "chat_select" on chat_messages
  for select using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
  );

create policy "chat_insert" on chat_messages
  for insert with check (
    workspace_id in (select id from workspaces where user_id = auth.uid())
  );

-- -----------------------------------------------
-- PROJECT COLLECTIONS (user-facing "projects" that contain multiple shots)
-- -----------------------------------------------
create table if not exists project_collections (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table project_collections enable row level security;

create policy "collection_select" on project_collections
  for select using (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "collection_insert" on project_collections
  for insert with check (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "collection_update" on project_collections
  for update using (workspace_id in (select id from workspaces where user_id = auth.uid()));
create policy "collection_delete" on project_collections
  for delete using (workspace_id in (select id from workspaces where user_id = auth.uid()));

-- Add collection_id to projects (run as migration)
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS collection_id uuid references project_collections(id) on delete set null;

create trigger collection_updated_at
  before update on project_collections
  for each row execute procedure set_updated_at();

-- -----------------------------------------------
-- WORKSPACE MEMORIES (persistent refinement preferences)
-- -----------------------------------------------
create table if not exists workspace_memories (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  note         text not null,
  created_at   timestamptz not null default now()
);

alter table workspace_memories enable row level security;

create policy "memory_select" on workspace_memories
  for select using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
  );

create policy "memory_insert" on workspace_memories
  for insert with check (
    workspace_id in (select id from workspaces where user_id = auth.uid())
  );

create policy "memory_delete" on workspace_memories
  for delete using (
    workspace_id in (select id from workspaces where user_id = auth.uid())
  );

-- -----------------------------------------------
-- Storage buckets
-- Create in Supabase dashboard → Storage:
--   ghost-inputs  (private)
--   ghost-outputs (private)
-- -----------------------------------------------

-- -----------------------------------------------
-- updated_at trigger
-- -----------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger workspaces_updated_at
  before update on workspaces
  for each row execute procedure set_updated_at();

create trigger projects_updated_at
  before update on projects
  for each row execute procedure set_updated_at();

-- -----------------------------------------------
-- WORKSPACE MODULES (run once as a migration)
-- -----------------------------------------------
-- ALTER TABLE workspaces
--   ADD COLUMN IF NOT EXISTS modules text[] NOT NULL DEFAULT '{"fashion"}';
