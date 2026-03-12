create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  document_number text,
  contact_email text,
  full_name text,
  apartment_number text not null,
  role text not null check (role in ('owner', 'admin', 'super_admin')) default 'owner',
  is_active boolean not null default true,
  created_at timestamp with time zone default now()
);

alter table public.profiles
add column if not exists document_number text;

alter table public.profiles
add column if not exists contact_email text;

create unique index if not exists idx_profiles_document_number_unique
on public.profiles (document_number)
where document_number is not null;

create unique index if not exists idx_profiles_contact_email_unique
on public.profiles (contact_email)
where contact_email is not null;

alter table public.profiles
add column if not exists is_active boolean not null default true;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
add constraint profiles_role_check
check (role in ('owner', 'admin', 'super_admin'));

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  apartment_number text not null,
  paid_month date not null,
  amount numeric(12, 2) not null,
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  receipt_url text,
  channel text not null check (channel in ('mipagoamigo', 'manual_upload')),
  created_at timestamp with time zone default now(),
  validated_at timestamp with time zone,
  validated_by uuid references public.profiles(id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  concept text not null,
  expense_month date not null,
  amount numeric(12, 2) not null,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  target_profile_id uuid references public.profiles(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.email_notification_queue (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  recipient_profile_id uuid references public.profiles(id),
  payment_id uuid references public.payments(id),
  category text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.email_notification_queue enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id and role = 'owner' and is_active = true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id and role = 'owner' and is_active = true);

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
on public.profiles for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and p.is_active = true
  )
);

drop policy if exists "Super admins can read all profiles" on public.profiles;
create policy "Super admins can read all profiles"
on public.profiles for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin' and p.is_active = true
  )
);

drop policy if exists "Super admins can update all profiles" on public.profiles;
create policy "Super admins can update all profiles"
on public.profiles for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin' and p.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin' and p.is_active = true
  )
);

drop policy if exists "Owners can create own payments" on public.payments;
create policy "Owners can create own payments"
on public.payments for insert
with check (
  auth.uid() = owner_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  )
);

drop policy if exists "Owners can view own payments" on public.payments;
create policy "Owners can view own payments"
on public.payments for select
using (
  auth.uid() = owner_id
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  )
);

drop policy if exists "Admins can view all payments" on public.payments;
create policy "Admins can view all payments"
on public.payments for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and p.is_active = true
  )
);

drop policy if exists "Admins can validate payments" on public.payments;
create policy "Admins can validate payments"
on public.payments for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and p.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and p.is_active = true
  )
);

drop policy if exists "Admins can manage expenses" on public.expenses;
create policy "Admins can manage expenses"
on public.expenses for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and p.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and p.is_active = true
  )
);

drop policy if exists "Super admins can read audit logs" on public.admin_audit_logs;
create policy "Super admins can read audit logs"
on public.admin_audit_logs for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin' and p.is_active = true
  )
);

drop policy if exists "Admins can insert audit logs" on public.admin_audit_logs;
create policy "Admins can insert audit logs"
on public.admin_audit_logs for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and p.is_active = true
  )
);

drop policy if exists "Super admins can read email queue" on public.email_notification_queue;
create policy "Super admins can read email queue"
on public.email_notification_queue for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin' and p.is_active = true
  )
);

drop policy if exists "Admins can read email queue" on public.email_notification_queue;
create policy "Admins can read email queue"
on public.email_notification_queue for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and p.is_active = true
  )
);

drop policy if exists "Admins can update email queue" on public.email_notification_queue;
create policy "Admins can update email queue"
on public.email_notification_queue for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and p.is_active = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and p.is_active = true
  )
);

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

drop policy if exists "Users upload own receipts" on storage.objects;
create policy "Users upload own receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'receipts' and split_part(name, '/', 1) = auth.uid()::text and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  )
);

drop policy if exists "Users view own receipts" on storage.objects;
create policy "Users view own receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'receipts' and split_part(name, '/', 1) = auth.uid()::text and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active = true
  )
);

drop policy if exists "Admins view all receipts" on storage.objects;
create policy "Admins view all receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'receipts' and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin') and p.is_active = true
  )
);

create or replace function public.log_profile_security_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    insert into public.admin_audit_logs (actor_id, target_profile_id, action, details)
    values (
      auth.uid(),
      new.id,
      'profile_security_updated',
      jsonb_build_object(
        'old_role', old.role,
        'new_role', new.role,
        'old_is_active', old.is_active,
        'new_is_active', new.is_active
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_profile_security_changes on public.profiles;
create trigger trg_log_profile_security_changes
after update on public.profiles
for each row
execute procedure public.log_profile_security_changes();

create or replace function public.queue_payment_registered_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_record public.profiles%rowtype;
  admin_record record;
begin
  select *
  into owner_record
  from public.profiles p
  where p.id = new.owner_id;

  if owner_record.contact_email is not null then
    insert into public.email_notification_queue (
      recipient_email,
      recipient_profile_id,
      payment_id,
      category,
      subject,
      payload
    ) values (
      owner_record.contact_email,
      owner_record.id,
      new.id,
      'payment_registered_owner',
      'Nuevo pago registrado',
      jsonb_build_object(
        'owner_name', owner_record.full_name,
        'apartment_number', new.apartment_number,
        'amount', new.amount,
        'paid_month', new.paid_month,
        'status', new.status
      )
    );
  end if;

  for admin_record in
    select p.id, p.contact_email, p.full_name
    from public.profiles p
    where p.role in ('admin', 'super_admin')
      and p.is_active = true
      and p.contact_email is not null
  loop
    insert into public.email_notification_queue (
      recipient_email,
      recipient_profile_id,
      payment_id,
      category,
      subject,
      payload
    ) values (
      admin_record.contact_email,
      admin_record.id,
      new.id,
      'payment_registered_admin',
      'Pago pendiente por validar',
      jsonb_build_object(
        'owner_name', owner_record.full_name,
        'apartment_number', new.apartment_number,
        'amount', new.amount,
        'paid_month', new.paid_month,
        'status', new.status
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_queue_payment_registered_emails on public.payments;
create trigger trg_queue_payment_registered_emails
after insert on public.payments
for each row
execute procedure public.queue_payment_registered_emails();

create or replace function public.reset_password_by_apartment_and_email(
  p_apartment_number text,
  p_contact_email text,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_apartment text;
  normalized_email text;
  target_user_id uuid;
begin
  normalized_apartment := lower(regexp_replace(coalesce(p_apartment_number, ''), '[^0-9A-Za-z]', '', 'g'));
  normalized_email := lower(trim(coalesce(p_contact_email, '')));

  if normalized_apartment = '' then
    raise exception 'Debes indicar el número de apartamento';
  end if;

  if normalized_email = '' or position('@' in normalized_email) = 0 then
    raise exception 'Debes indicar un correo válido';
  end if;

  if length(coalesce(p_new_password, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;

  select p.id
  into target_user_id
  from public.profiles p
  where lower(regexp_replace(coalesce(p.apartment_number, ''), '[^0-9A-Za-z]', '', 'g')) = normalized_apartment
    and lower(coalesce(p.contact_email, '')) = normalized_email
    and p.is_active = true
  limit 1;

  if target_user_id is null then
    raise exception 'No fue posible restablecer la contraseña con los datos ingresados';
  end if;

  update auth.users u
  set
    encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    updated_at = now()
  where u.id = target_user_id;

  if not found then
    raise exception 'No fue posible restablecer la contraseña con los datos ingresados';
  end if;
end;
$$;

grant execute on function public.reset_password_by_apartment_and_email(text, text, text) to anon;
grant execute on function public.reset_password_by_apartment_and_email(text, text, text) to authenticated;
grant execute on function public.reset_password_by_apartment_and_email(text, text, text) to service_role;
