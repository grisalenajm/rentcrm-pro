import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PropertiesModule } from './properties/properties.module';
import { ClientsModule } from './clients/clients.module';
import { BookingsModule } from './bookings/bookings.module';
import { FinancialsModule } from './financials/financials.module';
import { ContractsModule } from './contracts/contracts.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { OrganizationModule } from './organization/organization.module';
import { ICalModule } from './ical/ical.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ExcelModule } from './excel/excel.module';
import { TranslationModule } from './translation/translation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    PropertiesModule,
    ClientsModule,
    BookingsModule,
    FinancialsModule,
    ContractsModule,
    EvaluationsModule,
    OrganizationModule,
    ICalModule,
    ExpensesModule,
    ExcelModule,
    TranslationModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
