# Asistencia Docente SaaS

Plataforma multi-tenant para la gestión de asistencia escolar ágil y moderna.

## Stack Tecnológico
- **Frontend**: Next.js 15 (App Router) + TypeScript
- **Estilos**: Tailwind CSS (Glassmorphism UI)
- **Backend**: Supabase (Postgres + Auth + RLS)
- **Despliegue**: Vercel

## Configuración del Proyecto

### 1. Requisitos Previos
- Node.js 18+
- Cuenta en Supabase

### 2. Variables de Entorno
Crea un archivo `.env.local` en la raíz con las siguientes variables (obtenidas de tu proyecto Supabase):
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon_de_supabase
```

### 3. Instalación y Ejecución
```bash
npm install
npm run dev
```

### 4. Base de Datos
El esquema está en `schema.sql`. Puedes aplicarlo directamente en el editor SQL de Supabase. Incluye:
- Políticas RLS para aislamiento de datos.
- Índices de rendimiento.
- Soporte para organizaciones e individuos.

## Estructura de Navegación
- `/login`: Autenticación de usuarios.
- `/onboarding`: Configuración inicial (Individual o Institución).
- `/`: Dashboard principal con lista de grupos.
- `/groups/new`: Creación de grupos e import masivo de alumnos.
- `/attendance/[id]`: Toma de asistencia rápida.
- `/history/[id]`: Historial de sesiones y exportación CSV.

## Limitaciones del Plan Gratuito (Supabase & Vercel)
- **Base de Datos**: 500MB de almacenamiento.
- **Auth**: Hasta 50,000 MAU.
- **Vercel**: Límites estándares de Hobby projects (ancho de banda, invocaciones).
