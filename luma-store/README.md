# LUMA STORE SYSTEM

Sistema de Gestión Integral para Tiendas de Ropa y Accesorios.

## Stack
- **Backend**: Django 5 + Django REST Framework
- **Frontend Admin**: React 18 + Vite + Tailwind CSS (puerto 5173)
- **Frontend Store**: React 18 + Vite + Tailwind CSS (puerto 5174)
- **Base de datos**: SQLite (desarrollo) / PostgreSQL (producción)

## Estructura del proyecto
```
luma-store/
├── backend/          ← Django + DRF
│   ├── apps/         ← Módulos del sistema
│   └── config/       ← Configuración Django
├── frontend/
│   ├── admin/        ← Panel de Administración
│   └── store/        ← Portal de Clientes
└── .gitignore
```

## Desarrollo rápido

### Backend
```bash
cd backend
venv\Scripts\activate
python manage.py runserver
```

### Frontend Admin
```bash
cd frontend/admin
npm run dev
```

### Frontend Store (Portal)
```bash
cd frontend/store
npm run dev
```
