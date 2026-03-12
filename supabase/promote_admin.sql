-- Ejecuta este script en Supabase SQL Editor con rol de propietario del proyecto.
-- 1) Cambia el email y nombre objetivo en la llamada final.
-- 2) Asegúrate de que el usuario ya exista en Auth (signup previo).

create or replace function public.promote_user_to_admin(
  target_email text,
  admin_name text default 'Administrador Principal'
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
    raise exception 'No existe un usuario en auth.users con el email: %', target_email;
  end if;

  insert into public.profiles (id, document_number, full_name, apartment_number, role, is_active)
  values (target_user_id, null, admin_name, 'ADMIN', 'admin', true)
  on conflict (id)
  do update set
    full_name = excluded.full_name,
    apartment_number = excluded.apartment_number,
    role = 'admin',
    is_active = true;
end;
$$;

grant execute on function public.promote_user_to_admin(text, text) to service_role;

-- Ejemplo de uso:
-- select public.promote_user_to_admin('admin@tuedificio.com', 'Admin General');
