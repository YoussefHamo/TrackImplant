-- Server-side trigger for cross-branch request notifications
create or replace function public.handle_cross_branch_request_notification()
returns trigger as $$
declare
  target_user record;
  notif_title text;
  notif_message text;
  notif_type text;
begin
  if tg_op = 'INSERT' then
    -- Notify all managers of the source branch (they need to approve/ship)
    notif_title := 'طلب عبور جديد';
    notif_message := format('طلب %s × %s إلى فرع %s', new.quantity, new.item_name, (select name from public.branches where id = new.to_branch_id));
    notif_type := 'info';
    for target_user in
      select id from public.users
      where role = 'Manager' and branch_id = new.from_branch_id and is_active = true
    loop
      insert into public.notifications (user_id, title, message, type, link)
      values (target_user.id, notif_title, notif_message, notif_type, '/inventory');
    end loop;
  elsif tg_op = 'UPDATE' and old.status <> new.status then
    -- Notify the requesting user about status change
    if new.status = 'approved' then
      notif_title := 'تم الموافقة على طلب العبور';
      notif_message := format('تمت الموافقة على طلب %s × %s', new.quantity, new.item_name);
      notif_type := 'success';
    elsif new.status = 'rejected' then
      notif_title := 'تم رفض طلب العبور';
      notif_message := format('تم رفض طلب %s × %s', new.quantity, new.item_name);
      notif_type := 'warning';
    elsif new.status = 'in_transit' then
      notif_title := 'طلب العبور في الطريق';
      notif_message := format('طلب %s × %s أصبح في الطريق إليك', new.quantity, new.item_name);
      notif_type := 'info';
    elsif new.status = 'delivered' then
      notif_title := 'تم تسليم طلب العبور';
      notif_message := format('تم تسليم %s × %s', new.quantity, new.item_name);
      notif_type := 'success';
    end if;
    if new.requested_by is not null then
      insert into public.notifications (user_id, title, message, type, link)
      values (new.requested_by, notif_title, notif_message, notif_type, '/inventory');
    end if;
    -- If delivered, also notify the source branch manager
    if new.status = 'delivered' then
      for target_user in
        select id from public.users
        where role = 'Manager' and branch_id = new.from_branch_id and is_active = true
      loop
        insert into public.notifications (user_id, title, message, type, link)
        values (target_user.id, 'تم تسليم طلب العبور', format('تم تسليم %s × %s إلى %s', new.quantity, new.item_name, (select name from public.branches where id = new.to_branch_id)), 'success', '/inventory');
      end loop;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_cross_branch_request_notification on public.cross_branch_requests;
create trigger trg_cross_branch_request_notification
  after insert or update of status on public.cross_branch_requests
  for each row execute function public.handle_cross_branch_request_notification();
