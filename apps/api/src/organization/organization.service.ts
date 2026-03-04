import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organización no encontrada');
    // No devolvemos smtpPass
    const { smtpPass, ...rest } = org as any;
    return { ...rest, smtpPassSet: !!smtpPass };
  }

  async update(id: string, dto: any) {
    const data: any = {};
    const fields = ['name','nif','address','phone','email','logo','smtpHost','smtpPort','smtpUser','smtpFrom','currency','dateFormat'];
    fields.forEach(f => { if (dto[f] !== undefined) data[f] = dto[f]; });
    if (dto.smtpPass) data.smtpPass = dto.smtpPass;
    return this.prisma.organization.update({ where: { id }, data });
  }
}
