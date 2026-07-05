-- Fix notification links: /inventory → /dashboard/inventory
-- The React route is /dashboard/inventory, but all triggers used /inventory
-- which caused navigation to a non-existent route → redirect to login

-- 1. Fix existing notification links in the database
update public.notifications
set link = '/dashboard/inventory'
where link = '/inventory';

-- 2. Fix cross-branch request notification trigger
create or replace function public.handle_cross_branch_request_notification()
returns trigger as $$
declare
  target_user record;
  notif_title text;
  notif_message text;
  notif_type text;
begin
  if tg_op = 'INSERT' then
    notif_title := 'طلب مخزون جديد';
    notif_message := format('طلب %s × %s من فرع %s', new.quantity, new.item_name, (select name from public.branches where id = new.to_branch_id));
    notif_type := 'info';
    for target_user in
      select auth_user_id from public.users
      where role = 'Manager' and branch_id = new.from_branch_id and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.auth_user_id, notif_title, notif_message, notif_type, '/dashboard/inventory');
    end loop;
    for target_user in
      select auth_user_id from public.users
      where role in ('Manager', 'Receptionist') and branch_id = new.to_branch_id and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.auth_user_id, 'تم إرسال طلب مخزون', format('تم إرسال طلب %s × %s إلى المستودع الرئيسي', new.quantity, new.item_name), 'info', '/dashboard/inventory');
    end loop;
  elsif tg_op = 'UPDATE' and old.status <> new.status then
    if new.status = 'approved' then
      notif_title := 'تم الموافقة على الطلب';
      notif_message := format('تمت الموافقة على طلب %s × %s', new.quantity, new.item_name);
      notif_type := 'success';
    elsif new.status = 'rejected' then
      notif_title := 'تم رفض الطلب';
      notif_message := format('تم رفض طلب %s × %s', new.quantity, new.item_name);
      notif_type := 'warning';
    else
      return new;
    end if;
    for target_user in
      select auth_user_id from public.users
      where role in ('Manager', 'Receptionist') and branch_id = new.to_branch_id and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.auth_user_id, notif_title, notif_message, notif_type, '/dashboard/inventory');
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 3. Fix delivery notification trigger
create or replace function public.handle_cross_branch_delivery_notification()
returns trigger as $$
declare
  req record;
  target_user record;
  notif_title text;
  notif_message text;
  notif_type text;
begin
  if tg_op = 'INSERT' then
    select * into req from public.cross_branch_requests where id = new.request_id;
    if not found then return new; end if;
    notif_title := 'تم إنشاء الشحنة';
    notif_message := format('شحنة %s × %s جاري تجهيزها', req.quantity, req.item_name);
    notif_type := 'info';
    for target_user in
      select auth_user_id from public.users
      where role in ('Manager', 'Receptionist') and branch_id in (req.from_branch_id, req.to_branch_id) and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.auth_user_id, notif_title, notif_message, notif_type, '/dashboard/inventory');
    end loop;
  elsif tg_op = 'UPDATE' and old.status <> new.status then
    select * into req from public.cross_branch_requests where id = new.request_id;
    if not found then return new; end if;
    if new.status = 'picked_up' then
      notif_title := 'تم استلام الشحنة';
      notif_message := format('شحنة %s × %s تم استلامها من الفرع المورد', req.quantity, req.item_name);
      notif_type := 'info';
    elsif new.status = 'in_transit' then
      notif_title := 'الشحنة في الطريق';
      notif_message := format('شحنة %s × %s في الطريق إليك', req.quantity, req.item_name);
      notif_type := 'info';
    elsif new.status = 'arrived' then
      notif_title := 'الشحنة وصلت';
      notif_message := format('شحنة %s × %s وصلت إلى الفرع', req.quantity, req.item_name);
      notif_type := 'success';
    elsif new.status = 'completed' then
      notif_title := 'تم اكتمال الشحنة';
      notif_message := format('شحنة %s × %s تم اكتمالها بنجاح', req.quantity, req.item_name);
      notif_type := 'success';
    else
      return new;
    end if;
    for target_user in
      select auth_user_id from public.users
      where role in ('Manager', 'Receptionist') and branch_id in (req.from_branch_id, req.to_branch_id) and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.auth_user_id, notif_title, notif_message, notif_type, '/dashboard/inventory');
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 4. Fix return notification trigger
create or replace function public.handle_return_notification()
returns trigger as $$
declare
  target_user record;
begin
  if tg_op = 'INSERT' then
    for target_user in
      select auth_user_id from public.users
      where role = 'Manager' and branch_id = new.branch_id and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.auth_user_id, 'طلب إرجاع جديد',
        format('تم تقديم طلب إرجاع %s × %s', new.quantity, new.item_name),
        'info', '/dashboard/inventory');
    end loop;
  elsif tg_op = 'UPDATE' and old.status <> new.status then
    if new.status = 'approved' then
      for target_user in
        select auth_user_id from public.users
        where role in ('Manager', 'Receptionist') and branch_id = new.branch_id and is_active = true
      loop
        insert into public.notifications (user_id, title, message, type, link)
        values (target_user.auth_user_id, 'تم الموافقة على الإرجاع',
          format('تمت الموافقة على إرجاع %s × %s', new.quantity, new.item_name),
          'success', '/dashboard/inventory');
      end loop;
    elsif new.status = 'rejected' then
      for target_user in
        select auth_user_id from public.users
        where role in ('Manager', 'Receptionist') and branch_id = new.branch_id and is_active = true
      loop
        insert into public.notifications (user_id, title, message, type, link)
        values (target_user.auth_user_id, 'تم رفض الإرجاع',
          format('تم رفض إرجاع %s × %s', new.quantity, new.item_name),
          'warning', '/dashboard/inventory');
      end loop;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;
