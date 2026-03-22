import { Module } from '@nestjs/common';
import { PaperlessService } from './paperless.service';
import { PaperlessController } from './paperless.controller';

@Module({
  controllers: [PaperlessController],
  providers: [PaperlessService],
  exports: [PaperlessService],
})
export class PaperlessModule {}
