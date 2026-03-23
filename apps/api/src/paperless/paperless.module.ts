import { Module } from '@nestjs/common';
import { PaperlessService } from './paperless.service';
import { PaperlessController } from './paperless.controller';
import { RedisService } from './redis.service';

@Module({
  controllers: [PaperlessController],
  providers: [PaperlessService, RedisService],
  exports: [PaperlessService],
})
export class PaperlessModule {}
