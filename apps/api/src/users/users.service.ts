import { Injectable, NotFoundException, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { generateSecret, verifySync } from 'otplib';
import { generate as generateUri } from '@otplib/uri';
import * as QRCode from 'qrcode';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true, name: true, email: true,
        role: true, isActive: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true, name: true, email: true,
        role: true, isActive: true, createdAt: true,
        otpEnabled: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(dto: CreateUserDto, organizationId: string) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('El email ya está en uso');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
        organizationId,
      },
      select: {
        id: true, name: true, email: true,
        role: true, isActive: true, createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto, organizationId: string) {
    await this.findOne(id, organizationId);
    const { password, ...rest } = dto;
    return this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10), passwordChangedAt: new Date() } : {}),
      },
      select: {
        id: true, name: true, email: true,
        role: true, isActive: true, createdAt: true,
      },
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true },
    });
  }

  async resetPassword(id: string, organizationId: string): Promise<{ tempPassword: string }> {
    await this.findOne(id, organizationId);
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    const buf = randomBytes(12);
    const tempPassword = Array.from(buf).map((b) => chars[b % chars.length]).join('');
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash, passwordChangedAt: new Date() } });
    return { tempPassword };
  }

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    if (newPassword.length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('La contraseña actual es incorrecta');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    return { success: true };
  }

  // ── OTP / 2FA ─────────────────────────────────────────────────────────────

  async otpSetup(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, otpEnabled: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.otpEnabled) throw new BadRequestException('El 2FA ya está activado');

    const secret = generateSecret();
    const otpauthUrl = generateUri({
      type: 'totp',
      label: user.email,
      params: { secret, issuer: 'RentCRM Pro' },
    });
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // Guardamos el secreto pendiente (aún no activado)
    await this.prisma.user.update({
      where: { id: userId },
      data: { otpSecret: secret, otpEnabled: false },
    });

    return { secret, qrCode, otpauthUrl };
  }

  async otpVerify(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { otpSecret: true, otpEnabled: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.otpSecret) throw new BadRequestException('Primero ejecuta /otp/setup');
    if (user.otpEnabled) throw new BadRequestException('El 2FA ya está activado');

    const isValid = verifySync({ token, secret: user.otpSecret })?.valid;
    if (!isValid) throw new UnauthorizedException('Código incorrecto');

    await this.prisma.user.update({
      where: { id: userId },
      data: { otpEnabled: true, otpVerifiedAt: new Date() },
    });

    return { otpEnabled: true };
  }

  async otpDisable(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { otpSecret: true, otpEnabled: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.otpEnabled || !user.otpSecret) throw new BadRequestException('El 2FA no está activado');

    const isValid = verifySync({ token, secret: user.otpSecret })?.valid;
    if (!isValid) throw new UnauthorizedException('Código incorrecto');

    await this.prisma.user.update({
      where: { id: userId },
      data: { otpEnabled: false, otpSecret: null, otpVerifiedAt: null },
    });

    return { otpEnabled: false };
  }
}
