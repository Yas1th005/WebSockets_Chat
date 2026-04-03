-- Run this in Supabase SQL editor.
-- Full Supabase persistence for users, conversations, and messages.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key default gen_random_uuid()::text,
  username text not null unique,
  email text not null unique,
  password text not null,
  userid text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id text primary key default gen_random_uuid()::text,
  participants text[] not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id text primary key default gen_random_uuid()::text,
  conversation_id text not null,
  sender text not null,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint fk_messages_conversation
    foreign key (conversation_id) references public.conversations(id) on delete cascade,
  constraint fk_messages_sender
    foreign key (sender) references public.users(id) on delete cascade
);

create index if not exists idx_users_email
  on public.users (email);

create index if not exists idx_users_userid
  on public.users (userid);

create index if not exists idx_conversations_participants
  on public.conversations using gin (participants);

create index if not exists idx_messages_conversation_id
  on public.messages (conversation_id);

create index if not exists idx_messages_created_at
  on public.messages (created_at);
