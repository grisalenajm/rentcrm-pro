import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

function require_env(name: string): string {
  const value = process.env[name];
  if (!value || value === 'CHANGE_ME') {
    console.error(`Error: ${name} is not set in .env`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const orgName    = require_env('SEED_ORG_NAME');
  const orgNif     = process.env.SEED_ORG_NIF     ?? '';
  const orgAddress = process.env.SEED_ORG_ADDRESS  ?? '';
  const adminEmail = require_env('SEED_ADMIN_EMAIL');
  const adminPass  = require_env('SEED_ADMIN_PASSWORD');
  const adminName  = process.env.SEED_ADMIN_NAME   ?? 'Admin';

  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: orgName,
      nif: orgNif,
      address: orgAddress,
    },
  });
  console.log('Organization:', org.name);

  const hash = await bcrypt.hash(adminPass, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      organizationId: org.id,
      name: adminName,
      email: adminEmail,
      passwordHash: hash,
      role: 'admin',
    },
  });
  console.log('Admin user:', admin.email);

  const categories = [
    { type: 'income',  name: 'Alquiler' },
    { type: 'income',  name: 'Servicios extra' },
    { type: 'expense', name: 'Limpieza' },
    { type: 'expense', name: 'Reparacion' },
    { type: 'expense', name: 'Suministros' },
    { type: 'expense', name: 'Seguro' },
    { type: 'expense', name: 'Impuestos' },
    { type: 'expense', name: 'Comunidad' },
  ];

  for (const cat of categories) {
    await prisma.financialCategory.upsert({
      where: { organizationId_type_name: { organizationId: org.id, type: cat.type, name: cat.name } },
      update: {},
      create: { organizationId: org.id, type: cat.type, name: cat.name },
    });
  }
  console.log('Financial categories created');

  console.log('\nSeed completed');
  console.log('  Email:', adminEmail);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
