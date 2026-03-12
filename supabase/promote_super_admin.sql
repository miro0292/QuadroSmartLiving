-- Ejecuta en Supabase SQL Editor con permisos del proyecto.
-- Promueve un usuario existente (por email) al rol super_admin.

create or replace function public.promote_user_to_super_admin(
  target_email text,
  display_name text default 'Super Usuario'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  select u.id
  into target_user_id
  from auth.users u
  where lower(u.email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'No existe usuario en auth.users con email: %', target_email;
  end if;

  insert into public.profiles (id, document_number, full_name, apartment_number, role, is_active)
  values (target_user_id, null, display_name, 'SUPER', 'super_admin', true)
  on conflict (id)
  do update set
    full_name = excluded.full_name,
    apartment_number = excluded.apartment_number,
    role = 'super_admin',
    is_active = true;
end;
$$;

grant execute on function public.promote_user_to_super_admin(text, text) to service_role;

-- Ejemplo:
-- select public.promote_user_to_super_admin('super@tuedificio.com', 'Super Usuario Principal');
