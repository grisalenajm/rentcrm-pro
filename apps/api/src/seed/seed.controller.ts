import { Controller, Post, ConflictException, HttpCode, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma.service';
import { Public } from '../auth/public.decorator';
import * as bcrypt from 'bcrypt';

@SkipThrottle()
@Controller('seed')
export class SeedController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async seed() {
    const existing = await this.prisma.user.findFirst();
    if (existing) {
      throw new ConflictException('Ya existe un usuario administrador');
    }

    let org = await this.prisma.organization.findFirst();
    if (!org) {
      org = await this.prisma.organization.create({
        data: { name: 'Mi organización' },
      });
    }

    const passwordHash = await bcrypt.hash('Admin1234!', 10);
    await this.prisma.user.create({
      data: {
        organizationId: org.id,
        name: 'Administrador',
        email: 'admin@rentalsuite.com',
        passwordHash,
        role: 'admin',
        isActive: true,
      },
    });

    return {
      message: 'Usuario admin creado',
      email: 'admin@rentalsuite.com',
      password: 'Admin1234!',
    };
  }
}
