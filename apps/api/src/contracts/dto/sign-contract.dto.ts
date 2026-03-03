import { IsString } from 'class-validator';

export class SignContractDto {
  @IsString()
  signatureImage: string;

  @IsString()
  signerName: string;
}
