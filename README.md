# RentCRM Pro

Sistema CRM para gestión de casas de alquiler con integración SES Hospedajes.

## Stack
- **Frontend**: React + TypeScript + TailwindCSS
- **Backend**: NestJS + Prisma + PostgreSQL
- **Cola**: Redis + BullMQ
- **Integración**: SES Hospedajes (Ministerio del Interior)

## Arrancar en desarrollo
```bash
cp .env.example .env
docker compose up -d postgres redis
cd apps/api && npm install && npm run dev
cd apps/frontend && npm install && npm run dev
```

## Despliegue
```bash
docker compose up -d --build
```
