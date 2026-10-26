-- 점심 메뉴 같이 정하기: Supabase 테이블 구조
-- Supabase 화면의 SQL Editor에 전체를 붙여넣고 Run을 누르세요.
-- 실행 전에 Authentication → Sign In / Providers에서 "Allow anonymous sign-ins"를 켜야 합니다.

-- 다음 날 자정(한국 시간)을 돌려준다. 방 만료 시각으로 쓴다.
create or replace function public.next_midnight_kst()
returns timestamptz
language sql
stable
as $$
  select (date_trunc('day', now() at time zone 'Asia/Seoul') + interval '1 day') at time zone 'Asia/Seoul';
$$;

-- 방
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default public.next_midnight_kst(),
  -- 룰렛 결과: 방장이 돌리면 채워지고, 모든 참여자가 같은 결과를 본다
  result_menu_id uuid,
  spin_angle double precision, -- 결과 칸 안에서 멈출 위치(0~1 비율). 모두의 화면에서 같은 메뉴에 멈추게 한다
  spun_at timestamptz
);

-- 참여자 (닉네임)
create table public.participants (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 12),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- 메뉴 후보
create table public.menus (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 10),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (room_id, name)
);

alter table public.rooms
  add constraint rooms_result_menu_fk foreign key (result_menu_id) references public.menus (id) on delete set null;

-- 투표: (방, 사용자)가 기본키라서 1인 1표가 보장된다. 다른 메뉴로 바꾸면 update한다.
create table public.votes (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  menu_id uuid not null references public.menus (id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index menus_room_idx on public.menus (room_id);
create index votes_room_idx on public.votes (room_id);

-- 접근 권한 확인용 함수 (RLS 정책 안에서 테이블을 다시 조회할 때 무한 반복을 막기 위해 security definer 사용)
create or replace function public.room_is_open(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from rooms where id = rid and expires_at > now());
$$;

create or replace function public.is_participant(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from participants where room_id = rid and user_id = auth.uid());
$$;

-- 행 단위 보안 (RLS)
alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.menus enable row level security;
alter table public.votes enable row level security;

-- rooms: 링크(방 id)를 아는 사람은 만료 전까지 볼 수 있고, 방장만 결과를 기록할 수 있다
create policy "rooms_select" on public.rooms
  for select to authenticated using (expires_at > now());
create policy "rooms_insert" on public.rooms
  for insert to authenticated with check (host_id = auth.uid());
create policy "rooms_update_host" on public.rooms
  for update to authenticated
  using (host_id = auth.uid() and expires_at > now())
  with check (host_id = auth.uid());

-- participants: 열린 방이면 볼 수 있고, 본인만 입장/닉네임 변경 가능
create policy "participants_select" on public.participants
  for select to authenticated using (public.room_is_open(room_id));
create policy "participants_insert_self" on public.participants
  for insert to authenticated with check (user_id = auth.uid() and public.room_is_open(room_id));
create policy "participants_update_self" on public.participants
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- menus: 참여자만 후보를 추가할 수 있다
create policy "menus_select" on public.menus
  for select to authenticated using (public.room_is_open(room_id));
create policy "menus_insert_participant" on public.menus
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_participant(room_id) and public.room_is_open(room_id));

-- votes: 참여자만, 본인 표만, 같은 방의 메뉴에만 투표할 수 있다
create policy "votes_select" on public.votes
  for select to authenticated using (public.room_is_open(room_id));
create policy "votes_insert_self" on public.votes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_participant(room_id)
    and public.room_is_open(room_id)
    and exists (select 1 from public.menus m where m.id = menu_id and m.room_id = votes.room_id)
  );
create policy "votes_update_self" on public.votes
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.room_is_open(room_id)
    and exists (select 1 from public.menus m where m.id = menu_id and m.room_id = votes.room_id)
  );
create policy "votes_delete_self" on public.votes
  for delete to authenticated using (user_id = auth.uid());

-- 실시간 동기화: 이 테이블들의 변경을 Supabase Realtime으로 보낸다
alter publication supabase_realtime add table public.rooms, public.participants, public.menus, public.votes;
