import { Controller, Get, NotFoundException } from '@nestjs/common';
import { Public } from './auth/public.decorator';

@Public()
@Controller()
export class AppController {
  @Get()
  getHello(): never {
    throw new NotFoundException();
  }
}
