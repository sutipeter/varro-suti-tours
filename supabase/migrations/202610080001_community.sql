begin;
create table public.members (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null check(username ~ '^[a-z0-9_.-]{3,40}$'),
 name text not null check(length(name) between 1 and 80),
 role text not null default 'member' check(role in ('member','admin')),
 active boolean not null default true,
 created timestamptz not null default now()
);
create function public.is_member() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.members where id=auth.uid() and active)$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.members where id=auth.uid() and active and role='admin')$$;
revoke all on function public.is_member(),public.is_admin() from public;
grant execute on function public.is_member(),public.is_admin() to authenticated;
create table public.site_pages(id text primary key, html text not null);
create table public.stops(id integer primary key,date text not null,title text not null,meta text not null,category text not null,body text not null,details text not null default '');
create table public.posts(id bigint generated always as identity primary key,user_id uuid not null references public.members(id),body text not null check(length(body) between 1 and 4000),created timestamptz not null default now(),pinned boolean not null default false);
create table public.comments(id bigint generated always as identity primary key,post_id bigint not null references public.posts(id) on delete cascade,user_id uuid not null references public.members(id),body text not null check(length(body) between 1 and 2000),created timestamptz not null default now());
create table public.likes(post_id bigint not null references public.posts(id) on delete cascade,user_id uuid not null references public.members(id),primary key(post_id,user_id));
create index on public.comments(post_id);
create index on public.posts(created desc);
alter table public.members enable row level security;
alter table public.site_pages enable row level security;
alter table public.stops enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
revoke all on public.members,public.site_pages,public.stops,public.posts,public.comments,public.likes from anon,authenticated;
grant select on public.members,public.site_pages,public.stops,public.posts,public.comments,public.likes to authenticated;
create policy members_read on public.members for select to authenticated using(public.is_member());
create policy page_read on public.site_pages for select to authenticated using(public.is_member());
create policy stops_read on public.stops for select to authenticated using(public.is_member());
create policy posts_read on public.posts for select to authenticated using(public.is_member());
create policy comments_read on public.comments for select to authenticated using(public.is_member());
create policy likes_read on public.likes for select to authenticated using(public.is_member());
-- Browser clients have read-only access. All mutations are authorized in the Edge Function.
create table public.login_attempts(key text primary key,count integer not null,started timestamptz not null);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon,authenticated;
create function public.consume_login_attempt(p_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare attempts integer;
begin
 delete from public.login_attempts where started < now()-interval '1 day';
 insert into public.login_attempts(key,count,started) values(p_key,1,now())
 on conflict(key) do update set count=case when login_attempts.started < now()-interval '15 minutes' then 1 else login_attempts.count+1 end,
 started=case when login_attempts.started < now()-interval '15 minutes' then now() else login_attempts.started end
 returning count into attempts;
 return attempts<=15;
end;$$;
revoke all on function public.consume_login_attempt(text) from public,anon,authenticated;
grant execute on function public.consume_login_attempt(text) to service_role;
grant all on public.members,public.site_pages,public.stops,public.posts,public.comments,public.likes,public.login_attempts to service_role;
grant usage,select on all sequences in schema public to service_role;
commit;
