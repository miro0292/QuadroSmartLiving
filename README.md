# Admin Quadro Smart Living

Aplicación web responsiva (mobile-first) para recaudo de cuotas de administración, registro de comprobantes, historial de pagos por propietario y validación centralizada para administradores.

## Stack técnico

- React + Vite
- Tailwind CSS
- Supabase (Auth + PostgreSQL + Storage)
- GitHub Pages para frontend

## Funcionalidades implementadas

- Login con Supabase Auth
- Login de propietario por **número de documento + contraseña**
- Control de acceso por roles (`owner`, `admin`, `super_admin`)
- Registro de pago por propietario con:
  - número de apartamento
  - mes pagado
  - monto
  - carga opcional de comprobante
- Descarga de certificado PDF por pago (propietario)
- Descarga de histórico de pagos en PDF (propietario)
- Botón directo a Mi Pago Amigo: http://mipagoamigo.com/MPA_WebSite/OwnProducts
- Historial de pagos por propietario
- Panel administrador con:
  - listado global de pagos
  - aprobación/rechazo de pagos
  - total recaudado por mes
  - promedio total de recaudo mensual
- Descarga de reporte detallado PDF por mes (detalle de pagos, total por propietario y total edificio)
- Página de egresos administrativos (registro y consulta)
- Página exclusiva de superusuario para gestión avanzada de usuarios y roles
- Bloqueo/desbloqueo de cuentas por superusuario
- Bitácora de auditoría para cambios de seguridad y validación de pagos
- Modo claro/oscuro

## UX/UI y branding

Como no se recibió el archivo del logo en este workspace, se aplicó una paleta base profesional editable en `tailwind.config.js`:

- Primario: `#3f7af3`
- Primario oscuro: `#2f61d6`
- Primario profundo: `#264dae`
- Fondo claro: `#f8fafc`
- Fondo oscuro: `#020617`

Guía rápida de sistema de diseño:

- Botón principal: clase `btn-primary`
- Botón secundario: clase `btn-secondary`
- Contenedor de contenido: clase `card`
- Espaciado: escala Tailwind por defecto (4/6/8/12)

Si compartes el logo, puedo extraer paleta exacta HEX y ajustar toda la identidad visual automáticamente.

---

## Configuración local paso a paso

### 1) Requisitos

- Node.js 20+
- Cuenta en Supabase

### 2) Instalar dependencias

```bash
npm install
```

### 3) Variables de entorno

Copia el archivo de ejemplo:

```bash
copy .env.example .env
```

Configura en `.env`:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_SUPABASE_ANON_KEY
VITE_CLOUDINARY_CLOUD_NAME=TU_CLOUDINARY_CLOUD_NAME
VITE_CLOUDINARY_UPLOAD_PRESET=TU_CLOUDINARY_UPLOAD_PRESET
```

### 3.1) Comunicación local y cloud (Supabase + Cloudinary)

- **Local:** la app en tu PC usa `.env` y se conecta directo a Supabase Cloud + Cloudinary.
- **GitHub Pages:** el workflow usa `GitHub Secrets` para inyectar las mismas variables en build.

Configura estos secrets en tu repositorio de GitHub:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET`

Ruta en GitHub: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`.

El workflow creado es: `.github/workflows/deploy-pages.yml`.

> Nunca uses `service_role` ni `api_secret` en frontend. Solo `anon key` de Supabase y `upload preset` de Cloudinary.

### 4) Base de datos y seguridad

1. En Supabase crea un proyecto.
2. Abre **SQL Editor**.
3. Ejecuta completo el script: `supabase/schema.sql`.

Este script crea:

- `profiles`
- `payments`
- `expenses`
- `admin_audit_logs`
- `email_notification_queue` (base para envío futuro de correos)
- políticas RLS
- trigger de auditoría para cambios de rol y estado activo/inactivo

### 4.0.1) Almacenamiento de comprobantes en Cloudinary

- Los comprobantes se almacenan en Cloudinary y se guarda su URL en `payments.receipt_url`.
- Crea un **Upload Preset** tipo **unsigned** en Cloudinary para frontend.
- Restringe formatos (`jpg,jpeg,png,pdf`) y tamaño máximo recomendado.

### 4.1) Crear propietario por script (documento, nombre, apartamento, contraseña, correo contacto)

1. En SQL Editor ejecuta `supabase/create_owner.sql`.
2. Luego ejecuta:

```sql
select public.create_owner_with_document(
  '1012345678',
  'Juan Perez',
  'Apto 101',
  'ClaveSegura123',
  'juan@email.com'
);
```

Esto crea el usuario en `auth.users` y su perfil en `public.profiles` con rol `owner`, documento y correo de contacto.

El sistema también deja en `email_notification_queue` los eventos de registro de pago para envío futuro de correo al propietario y a administradores.

### 5) Crear usuarios

- Propietarios: pueden registrarse desde la pantalla inicial.
- Propietarios: solo pueden ser creados por superadmin desde `/super/users` o por SQL.
- El botón y la funcionalidad de registro no están disponibles en login público.
- Administradores: usa el script `supabase/promote_admin.sql` para promover por correo.

Pasos rápidos para admin:

1. Crea el usuario en Auth (o regístralo desde el login).
2. En SQL Editor ejecuta `supabase/promote_admin.sql`.
3. Ejecuta:

```sql
select public.promote_user_to_admin('admin@tuedificio.com', 'Admin General');
```

Con eso el usuario queda con rol `admin` en `profiles`.

Promoción a superusuario (super_admin):

1. En SQL Editor ejecuta `supabase/promote_super_admin.sql`.
2. Ejecuta:

```sql
select public.promote_user_to_super_admin('super@tuedificio.com', 'Super Usuario Principal');
```

Con eso el usuario tendrá acceso a la página exclusiva `/super/users`.

Funciones avanzadas del superusuario en `/super/users`:

- Cambiar rol (`owner`, `admin`, `super_admin`)
- Bloquear o desbloquear cuentas (`is_active`)
- Editar datos de perfil
- Ver bitácora de seguridad (`admin_audit_logs`)

Reversión (admin → owner):

1. En SQL Editor ejecuta `supabase/demote_admin.sql`.
2. Ejecuta:

```sql
select public.demote_admin_to_owner('admin@tuedificio.com', 'Apto 101');
```

Con eso el usuario vuelve al rol `owner`.

Si el usuario estaba bloqueado, también se reactiva automáticamente.

### 6) Ejecutar local

```bash
npm run dev
```

---

## Despliegue en GitHub Pages

### 1) Ajustar `homepage`

En `package.json` reemplaza:

```json
"homepage": "https://TU_USUARIO.github.io/AdminQuadroSmartLiving"
```

### 2) Subir repositorio

Haz push del proyecto a GitHub.

### 3) Publicar

```bash
npm run deploy
```

También puedes publicar automáticamente con GitHub Actions (recomendado):

1. Haz push a `main`.
2. Ve a `Actions` y verifica el workflow **Deploy to GitHub Pages**.
3. En `Settings` → `Pages`, configura **Build and deployment** en **GitHub Actions**.

### 4) Verificar en GitHub

- `Settings` → `Pages`
- Source: rama `gh-pages`

> Nota: se usa `HashRouter` para compatibilidad con GitHub Pages.
> El `base path` de Vite se resuelve automáticamente en CI usando el nombre del repositorio.

---

## Estructura principal

- `src/lib/AuthContext.jsx`
- `src/components/ProtectedRoute.jsx`
- `src/pages/LoginPage.jsx`
- `src/pages/OwnerPaymentsPage.jsx`
- `src/pages/OwnerHistoryPage.jsx`
- `src/pages/AdminOverviewPage.jsx`
- `src/pages/AdminExpensesPage.jsx`
- `src/pages/SuperAdminPage.jsx`
- `src/lib/supabaseClient.js`
- `supabase/schema.sql`
- `supabase/create_owner.sql`
- `supabase/promote_admin.sql`
- `supabase/promote_super_admin.sql`
- `supabase/demote_admin.sql`
- `src/lib/pdfReports.js`

## SEO básico aplicado

En `index.html`:

- `meta description`
- `meta viewport`
- `meta theme-color`
- título del sitio

---

## Checklist post-despliegue (local + GitHub Pages)

### A. Verificación técnica

- [ ] La app carga sin pantalla en blanco.
- [ ] Login funciona en `http://localhost:5173`.
- [ ] Login funciona en URL de GitHub Pages.
- [ ] No aparecen errores de CORS/Auth en consola.

### B. Flujo propietario

- [ ] Usuario `owner` puede iniciar sesión.
- [ ] Puede registrar pago con apartamento, mes y monto.
- [ ] Puede subir comprobante (imagen o PDF).
- [ ] En historial visualiza su pago y estado.
- [ ] Puede abrir/descargar comprobante desde historial.

### C. Flujo administrador

- [ ] Usuario `admin` puede ver todos los pagos.
- [ ] Puede aprobar/rechazar pagos.
- [ ] Se actualiza total mensual y promedio de recaudo.
- [ ] Puede registrar egresos y ver listado.

### D. Flujo superusuario

- [ ] Usuario `super_admin` accede a `/super/users`.
- [ ] Puede cambiar roles (`owner/admin/super_admin`).
- [ ] Puede bloquear y desbloquear cuentas (`is_active`).
- [ ] Visualiza bitácora de auditoría (`admin_audit_logs`).

### E. Seguridad/RLS

- [ ] Un `owner` no puede ver pagos de otros propietarios.
- [ ] Un usuario bloqueado no puede operar en la app.
- [ ] Solo `admin/super_admin` validan pagos.
- [ ] Solo `super_admin` modifica perfiles globalmente.

### F. Operación en GitHub

- [ ] Secrets configurados: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`.
- [ ] Workflow `Deploy to GitHub Pages` finaliza en verde.
- [ ] GitHub Pages publicado correctamente en `Settings > Pages`.
