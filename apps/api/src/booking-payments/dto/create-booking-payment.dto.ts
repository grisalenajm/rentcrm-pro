import { IsString, IsNumber, IsDateString, IsOptional, IsIn } from 'class-validator';

export class CreateBookingPaymentDto {
  @IsIn(['fianza', 'pago_reserva', 'pago_final', 'devolucion_fianza'])
  concept: string;

  @IsNumber()
  amount: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
