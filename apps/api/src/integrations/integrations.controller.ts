import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  @Get('status')
  status() {
    return {
      ok: true,
      message: 'Integrations API reserved for game server plugins',
      docsUrl: '/docs',
    };
  }
}
