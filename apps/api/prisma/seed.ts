import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 'a80a9d68-5dd0-43eb-b0eb-2ac389dab5a2' },
    update: {},
    create: {
      name: 'RentCRM Demo',
      nif: 'B12345678',
      address: 'Calle Mayor 1, Madrid',
    },
  });
  console.log('✓ Organización:', org.name);

  const hash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@rentcrm.com' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Admin',
      email: 'admin@rentcrm.com',
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
  console.log('   Email: admin@rentcrm.com');
  console.log('   Pass:  admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
