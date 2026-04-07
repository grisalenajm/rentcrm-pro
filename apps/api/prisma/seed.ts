import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Demo Organization',
      nif: 'CHANGE_ME',
      address: 'CHANGE_ME',
      bankSwift: '',
      bankIban: '',
      bankBeneficiary: '',
    },
  });
  console.log('✓ Organización:', org.name);

  const hash = await bcrypt.hash('CHANGE_ME_PASSWORD', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: hash,
      role: 'admin',
    },
  });
  console.log('✓ Usuario admin:', admin.email);

  const categories = [
    { type: 'income',  name: 'Alquiler' },
    { type: 'income',  name: 'Servicios extra' },
    { type: 'expense', name: 'Limpieza' },
    { type: 'expense', name: 'Reparación' },
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
  console.log('✓ Categorías financieras creadas');

  const property = await prisma.property.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      organizationId: org.id,
      name: 'Casa Playa Norte',
      address: 'Calle del Mar 12',
      city: 'Marbella',
      province: 'Málaga',
      postalCode: '29600',
      rooms: 3,
      bathrooms: 2,
      maxGuests: 6,
      pricePerNight: 220,
      createdBy: admin.id,
    },
  });
  console.log('✓ Propiedad demo:', property.name);

  console.log('\n✅ Seed completado');
  console.log('   Email: admin@example.com');
  console.log('   Pass:  CHANGE_ME_PASSWORD');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
