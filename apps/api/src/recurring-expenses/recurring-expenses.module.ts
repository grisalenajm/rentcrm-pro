import { Module } from '@nestjs/common';
import { RecurringExpensesController } from './recurring-expenses.controller';
import { RecurringExpensesService } from './recurring-expenses.service';

@Module({
  controllers: [RecurringExpensesController],
  providers: [RecurringExpensesService],
})
export class RecurringExpensesModule {}
