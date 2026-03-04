import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule {}
