-- ⚠️⚠️ 임시(데모) 정책 — 보안 완화 상태 ⚠️⚠️
-- 목적: 사장님이 정식 도입을 결정하기 전, 누구나(anon)가 사장님 대시보드를
--   로그인 없이 열람·체험할 수 있도록 owner 전용 접근 제한을 임시 개방한다.
-- 영향(주의): 도매 차등단가(item_tiers) 등 기밀 데이터가 비로그인 사용자에게 노출되며,
--   누구나 주문/품목/설정을 편집·삭제할 수 있다. 운영 전환 전 반드시 복원할 것.
--
-- TODO[접근제어 복원] — 사장님 정식 사용 결정 시 반드시 되돌릴 것:
--   1) 이 파일 하단의 "복원 스니펫"을 실행해 TEMP_DEMO_* 정책을 모두 DROP
--   2) index.html 의 DEMO_OPEN_ACCESS 를 false 로 변경
--
-- RLS 는 정책을 OR 로 결합하므로, 아래 정책 추가만으로 anon 에 전체 권한이 부여된다
-- (기존 owner/buyer 정책은 그대로 보존 → 복원 시 DROP 만 하면 원상복구).

create policy "TEMP_DEMO orders all"          on orders          for all to anon using (true) with check (true);
create policy "TEMP_DEMO buyers all"          on buyers          for all to anon using (true) with check (true);
create policy "TEMP_DEMO items all"           on items           for all to anon using (true) with check (true);
create policy "TEMP_DEMO item_tiers all"      on item_tiers      for all to anon using (true) with check (true);
create policy "TEMP_DEMO settlements all"     on settlements     for all to anon using (true) with check (true);
create policy "TEMP_DEMO app_settings all"    on app_settings    for all to anon using (true) with check (true);
create policy "TEMP_DEMO system_settings all" on system_settings for all to anon using (true) with check (true);
create policy "TEMP_DEMO approved_owners all" on approved_owners for all to anon using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- 복원 스니펫 (정식 도입 시 실행):
--   drop policy if exists "TEMP_DEMO orders all"          on orders;
--   drop policy if exists "TEMP_DEMO buyers all"          on buyers;
--   drop policy if exists "TEMP_DEMO items all"           on items;
--   drop policy if exists "TEMP_DEMO item_tiers all"      on item_tiers;
--   drop policy if exists "TEMP_DEMO settlements all"     on settlements;
--   drop policy if exists "TEMP_DEMO app_settings all"    on app_settings;
--   drop policy if exists "TEMP_DEMO system_settings all" on system_settings;
--   drop policy if exists "TEMP_DEMO approved_owners all" on approved_owners;
-- ─────────────────────────────────────────────────────────────
