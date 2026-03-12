-- Ejecuta este script en Supabase SQL Editor con rol de propietario del proyecto.
-- Cambia el email objetivo en la llamada final.
-- Funciona tanto para admin como super_admin, y lo devuelve a owner.

create or replace function public.demote_admin_to_owner(
  target_email text,
  target_apartment text default 'SIN_APTO'
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

  insert into public.profiles (id, document_number, apartment_number, role, is_active)
  values (target_user_id, null, target_apartment, 'owner', true)
  on conflict (id)
  do update set
    apartment_number = coalesce(nullif(excluded.apartment_number, ''), public.profiles.apartment_number),
    role = 'owner',
    is_active = true;
end;
$$;

grant execute on function public.demote_admin_to_owner(text, text) to service_role;

-- Ejemplo de uso:
-- select public.demote_admin_to_owner('admin@tuedificio.com', 'Apto 101');
