import { Module } from '@nestjs/common';
import { PropertyRulesController } from './property-rules.controller';
import { PropertyRulesService } from './property-rules.service';
import { TranslationModule } from '../translation/translation.module';

@Module({
  imports: [TranslationModule],
  controllers: [PropertyRulesController],
  providers: [PropertyRulesService],
  exports: [PropertyRulesService],
})
export class PropertyRulesModule {}
