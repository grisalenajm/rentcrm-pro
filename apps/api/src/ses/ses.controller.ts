import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { SesService } from '../bookings/ses.service';
import { OrganizationService } from '../organization/organization.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const SES_ENDPOINTS: Record<string, string> = {
  produccion: 'https://hospedajes.ses.mir.es/hospedajes-web/ws/comunicacion',
  pruebas:    'https://hospedajes.pre-ses.mir.es/hospedajes-web/ws/comunicacion',
};

@Controller('ses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SesController {
  constructor(
    private sesService: SesService,
    private organizationService: OrganizationService,
  ) {}

  /**
   * POST /api/ses/test
   * Verifica las credenciales SES de la organización del usuario autenticado
   * llamando al endpoint del Ministerio y devuelve si la conexión fue exitosa.
   */
  @Post('test')
  @Roles('admin', 'gestor')
  async testConnection(@Request() req) {
    const org = await this.organizationService.findOne(req.user.organizationId);
    const entorno = (org as any).sesEntorno;
    const endpoint = entorno
      ? SES_ENDPOINTS[entorno] || (org as any).sesEndpoint || SES_ENDPOINTS['produccion']
      : (org as any).sesEndpoint || SES_ENDPOINTS['produccion'];

    if (!(org as any).sesUsuarioWs || !(org as any).sesCodigoArrendador) {
      return { ok: false, message: 'Credenciales SES incompletas — configura usuario y código arrendador en Ajustes → SES Hospedajes' };
    }

    return this.sesService.testConnection(
      endpoint,
      (org as any).sesUsuarioWs,
      (org as any).sesPasswordWs,
      (org as any).sesCodigoArrendador,
    );
  }
}
