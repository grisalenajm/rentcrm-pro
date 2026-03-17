import { Module } from '@nestjs/common';
import { PaperlessService } from './paperless.service';

@Module({
  providers: [PaperlessService],
  exports: [PaperlessService],
})
export class PaperlessModule {}
