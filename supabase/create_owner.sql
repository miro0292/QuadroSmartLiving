-- Script para crear propietario/admin con:
-- documento, nombre, apartamento y contraseña.
-- Login de la aplicación: apartamento + contraseña.
-- Ejecutar en Supabase SQL Editor.

-- Compatibilidad: garantiza columnas requeridas en perfiles
alter table if exists public.profiles
add column if not exists document_number text;

alter table if exists public.profiles
add column if not exists contact_email text;

alter table if exists public.profiles
add column if not exists is_active boolean not null default true;

create unique index if not exists idx_profiles_document_number_unique
on public.profiles (document_number)
where document_number is not null;

create unique index if not exists idx_profiles_contact_email_unique
on public.profiles (contact_email)
where contact_email is not null;

create extension if not exists pgcrypto;

create or replace function public.create_auth_user_with_email(
  p_email text,
  p_password text,
  p_user_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_user_id uuid;
  existing_user_id uuid;
begin
  if coalesce(p_email, '') = '' then
    raise exception 'El email interno de login es obligatorio';
  end if;

  if length(coalesce(p_password, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;

  select u.id
  into existing_user_id
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;

  if existing_user_id is not null then
    return existing_user_id;
  end if;

  new_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    lower(p_email),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    coalesce(p_user_meta, '{}'::jsonb),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  return new_user_id;
end;
$$;

create or replace function public.create_owner_with_document(
  p_document_number text,
  p_full_name text,
  p_apartment_number text,
  p_password text,
  p_contact_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  actor_role text;
  actor_active boolean;
  normalized_document text;
  normalized_apartment text;
  login_email text;
  new_user_id uuid;
  existing_profile_id uuid;
begin
  actor_id := auth.uid();

  if actor_id is not null then
    select p.role, p.is_active
    into actor_role, actor_active
    from public.profiles p
    where p.id = actor_id
    limit 1;

    if actor_role is distinct from 'super_admin' or actor_active is not true then
      raise exception 'Solo super_admin puede crear propietarios';
    end if;
  end if;

  normalized_document := regexp_replace(coalesce(p_document_number, ''), '[^0-9A-Za-z]', '', 'g');
  normalized_apartment := regexp_replace(coalesce(p_apartment_number, ''), '[^0-9A-Za-z]', '', 'g');

  if normalized_document = '' then
    raise exception 'La identificación es obligatoria';
  end if;

  if coalesce(p_full_name, '') = '' then
    raise exception 'El nombre es obligatorio';
  end if;

  if normalized_apartment = '' then
    raise exception 'El apartamento es obligatorio';
  end if;

  if length(coalesce(p_password, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;

  if p_contact_email is not null and position('@' in p_contact_email) = 0 then
    raise exception 'El correo de contacto no es válido';
  end if;

  login_email := 'apt.' || lower(normalized_apartment) || '@resident.local';

  select p.id
  into existing_profile_id
  from public.profiles p
  where p.document_number = normalized_document
  limit 1;

  if existing_profile_id is not null then
    raise exception 'Ya existe un propietario con identificación %', normalized_document;
  end if;

  new_user_id := public.create_auth_user_with_email(
    login_email,
    p_password,
    jsonb_build_object(
      'document_number', normalized_document,
      'full_name', p_full_name,
      'apartment_number', normalized_apartment
    )
  );

  if new_user_id is null then
    raise exception 'No fue posible crear el usuario propietario en Auth';
  end if;

  insert into public.profiles (
    id,
    document_number,
    contact_email,
    full_name,
    apartment_number,
    role,
    is_active
  )
  values (
    new_user_id,
    normalized_document,
    lower(nullif(p_contact_email, '')),
    p_full_name,
    normalized_apartment,
    'owner',
    true
  )
  on conflict (id)
  do update set
    document_number = excluded.document_number,
    contact_email = excluded.contact_email,
    full_name = excluded.full_name,
    apartment_number = excluded.apartment_number,
    role = 'owner',
    is_active = true;

  return new_user_id;
end;
$$;

create or replace function public.create_admin_with_document(
  p_document_number text,
  p_full_name text,
  p_apartment_number text,
  p_password text,
  p_contact_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  actor_role text;
  actor_active boolean;
  normalized_document text;
  normalized_apartment text;
  login_email text;
  new_user_id uuid;
begin
  actor_id := auth.uid();

  if actor_id is not null then
    select p.role, p.is_active
    into actor_role, actor_active
    from public.profiles p
    where p.id = actor_id
    limit 1;

    if actor_role is distinct from 'super_admin' or actor_active is not true then
      raise exception 'Solo super_admin puede crear administradores';
    end if;
  end if;

  normalized_document := regexp_replace(coalesce(p_document_number, ''), '[^0-9A-Za-z]', '', 'g');
  normalized_apartment := regexp_replace(coalesce(p_apartment_number, ''), '[^0-9A-Za-z]', '', 'g');

  if normalized_document = '' then
    raise exception 'La identificación es obligatoria';
  end if;

  if coalesce(p_full_name, '') = '' then
    raise exception 'El nombre es obligatorio';
  end if;

  if normalized_apartment = '' then
    raise exception 'El apartamento es obligatorio';
  end if;

  if length(coalesce(p_password, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;

  if p_contact_email is not null and position('@' in p_contact_email) = 0 then
    raise exception 'El correo de contacto no es válido';
  end if;

  login_email := 'apt.' || lower(normalized_apartment) || '@resident.local';

  new_user_id := public.create_auth_user_with_email(
    login_email,
    p_password,
    jsonb_build_object(
      'document_number', normalized_document,
      'full_name', p_full_name,
      'apartment_number', normalized_apartment
    )
  );

  if new_user_id is null then
    raise exception 'No fue posible crear el usuario administrador en Auth';
  end if;

  insert into public.profiles (
    id,
    document_number,
    contact_email,
    full_name,
    apartment_number,
    role,
    is_active
  )
  values (
    new_user_id,
    normalized_document,
    lower(nullif(p_contact_email, '')),
    p_full_name,
    normalized_apartment,
    'admin',
    true
  )
  on conflict (id)
  do update set
    document_number = excluded.document_number,
    contact_email = excluded.contact_email,
    full_name = excluded.full_name,
    apartment_number = excluded.apartment_number,
    role = 'admin',
    is_active = true;

  return new_user_id;
end;
$$;

grant execute on function public.create_owner_with_document(text, text, text, text, text) to service_role;
grant execute on function public.create_owner_with_document(text, text, text, text, text) to authenticated;

grant execute on function public.create_admin_with_document(text, text, text, text, text) to service_role;
grant execute on function public.create_admin_with_document(text, text, text, text, text) to authenticated;

grant execute on function public.create_auth_user_with_email(text, text, jsonb) to service_role;

-- ============================================
-- DATOS SOLICITADOS
-- ============================================
-- Propietario
select public.create_owner_with_document(
  '1013629888',
  'Miguel Rojas',
  '21001',
  '12345678',
  'miro0292@gmail.com'
);

-- Administrador
select public.create_admin_with_document(
  '10136298886',
  'Miguel Rojas',
  '1013629886',
  '12345678',
  'miro0292+admin@gmail.com'
);
