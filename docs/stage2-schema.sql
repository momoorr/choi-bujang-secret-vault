-- 2단계 DB 구조와 접근 권한
-- 가상 메모 4개는 Supabase SQL Editor에서 별도로 입력했습니다.
-- 이 파일에는 메모 본문이나 비밀키를 저장하지 않습니다.

begin;

create table if not exists public.notes (
  id bigint primary key,
  owner_id uuid,
  title text not null,
  content text not null
);

alter table public.notes enable row level security;

revoke all privileges on table public.notes
from public, anon, authenticated;

grant usage on schema public to service_role;
grant select on table public.notes to service_role;

commit;