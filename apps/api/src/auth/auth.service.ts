import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { verifySync } from 'otplib';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Si tiene 2FA activado, devolver tempToken en lugar del token de sesión
    if (user.otpEnabled && user.otpSecret) {
      const tempToken = this.jwt.sign(
        { sub: user.id, type: 'otp-pending' },
        { expiresIn: '5m' },
      );
      return { requiresOtp: true, tempToken };
    }

    return this.buildSessionResponse(user);
  }

  async validateOtp(tempToken: string, otpToken: string) {
    let payload: { sub: string; type: string };
    try {
      payload = this.jwt.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Token expirado o inválido');
    }

    if (payload.type !== 'otp-pending') {
      throw new UnauthorizedException('Token inválido');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.deletedAt || !user.otpEnabled || !user.otpSecret) {
      throw new UnauthorizedException('Usuario no válido');
    }

    const isValid = verifySync({ token: otpToken, secret: user.otpSecret })?.valid;
    if (!isValid) {
      throw new UnauthorizedException('Código incorrecto');
    }

    return this.buildSessionResponse(user);
  }

  private buildSessionResponse(user: {
    id: string; name: string; email: string; role: string; organizationId: string;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        isActive: true,
        deletedAt: true,
        passwordChangedAt: true,
      },
    });
  }
}
