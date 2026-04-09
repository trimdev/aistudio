-- ==============================================
-- GhostStudio – Supabase Schema + RLS Policies
-- Run this in your Supabase SQL editor
-- ==============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- -----------------------------------------------
-- WORKSPACES (one per Clerk user)
-- -----------------------------------------------
create table if not exists workspaces (
  id              uuid primary key default uuid_generate_v4(),
  clerk_user_id   text not null unique,
  name            text not null default 'My Workspace',
  gemini_api_key  text,          -- encrypted at rest by Supabase
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table workspaces enable row level security;

-- Users can only see/edit their own workspace
create policy "workspace_select" on workspaces
  for select using (clerk_user_id = requesting_user_id());

create policy "workspace_insert" on workspaces
  for insert with check (clerk_user_id = requesting_user_id());

create policy "workspace_update" on workspaces
  for update using (clerk_user_id = requesting_user_id());

-- -----------------------------------------------
-- PROJECTS
-- -----------------------------------------------
create table if not exists projects (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  status          text not null default 'pending'
                    check (status in ('pending','processing','completed','failed')),
  input_images    text[] not null default '{}',  -- storage paths
  output_image    text,                           -- storage path
  prompt_used     text,
  model_used      text not null default 'gemini-2.5-flash-preview-04-17',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table projects enable row level security;

create policy "project_select" on projects
  for select using (
    workspace_id in (
      select id from workspaces where clerk_user_id = requesting_user_id()
    )
  );

create policy "project_insert" on projects
  for insert with check (
    workspace_id in (
      select id from workspaces where clerk_user_id = requesting_user_id()
    )
  );

create policy "project_update" on projects
  for update using (
    workspace_id in (
      select id from workspaces where clerk_user_id = requesting_user_id()
    )
  );

create policy "project_delete" on projects
  for delete using (
    workspace_id in (
      select id from workspaces where clerk_user_id = requesting_user_id()
    )
  );

-- -----------------------------------------------
-- Helper: expose Clerk user ID via JWT claim
-- (Clerk puts the user ID in the "sub" claim)
-- -----------------------------------------------
create or replace function requesting_user_id() returns text as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  )::text;
$$ language sql stable;

-- -----------------------------------------------
-- Storage buckets
-- -----------------------------------------------
-- Create via Supabase dashboard or CLI:
--   supabase storage create ghost-inputs  --public=false
--   supabase storage create ghost-outputs --public=false
--
-- Storage RLS (add in dashboard → Storage → Policies):
--   Allow authenticated users to upload/read only paths
--   matching their own clerk_user_id prefix.

-- -----------------------------------------------
-- Updated_at trigger
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
