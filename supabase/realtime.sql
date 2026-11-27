-- Realtime riêng tư (Realtime Authorization): chỉ người đã đăng nhập (phiên đã xác nhận thiết bị: schema.sql session_trusted)
-- mới vào được kênh, đúng người mới vào được kênh giao dịch.
-- Chạy SAU trades.sql: Supabase SQL Editor → dán toàn bộ → Run (chạy lại được). Sau đó:
--   Project Settings → Realtime → Realtime Settings: TẮT "Allow public access" (chỉ cho kênh riêng tư) → Save.
-- Game mở mọi kênh ở chế độ riêng tư (src/online/presence.js, src/online/trade.js: private: true), nên PHẢI chạy file này
-- thì người chơi mới thấy nhau / giao dịch được.
--
-- Kênh của game:
--   map-<id bản đồ>   người chơi trên cùng bản đồ (presence + tin bước đi + lời mời giao dịch): ai đã đăng nhập cũng vào được
--   trade-<id>        một giao dịch: chỉ hai người trong giao dịch đó (bảng public.trades) mới đọc / gửi được

-- realtime.messages do Supabase sở hữu và đã bật RLS sẵn (không cần, cũng không được phép ALTER bảng này)

drop policy if exists "realtime: bản đồ, đọc" on realtime.messages;
create policy "realtime: bản đồ, đọc" on realtime.messages
  for select to authenticated
  using ((select realtime.topic()) like 'map-%' and (select public.session_trusted()));

drop policy if exists "realtime: bản đồ, gửi" on realtime.messages;
create policy "realtime: bản đồ, gửi" on realtime.messages
  for insert to authenticated
  with check ((select realtime.topic()) like 'map-%' and (select public.session_trusted()));

drop policy if exists "realtime: giao dịch, đọc" on realtime.messages;
create policy "realtime: giao dịch, đọc" on realtime.messages
  for select to authenticated
  using (
    (select realtime.topic()) like 'trade-%'
    and (select public.session_trusted())
    and exists (
      select 1 from public.trades t
      where t.id::text = substr((select realtime.topic()), 7) and (select auth.uid()) in (t.a, t.b)
    )
  );

drop policy if exists "realtime: giao dịch, gửi" on realtime.messages;
create policy "realtime: giao dịch, gửi" on realtime.messages
  for insert to authenticated
  with check (
    (select realtime.topic()) like 'trade-%'
    and (select public.session_trusted())
    and exists (
      select 1 from public.trades t
      where t.id::text = substr((select realtime.topic()), 7) and (select auth.uid()) in (t.a, t.b)
    )
  );
