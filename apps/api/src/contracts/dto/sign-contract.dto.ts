import { IsString, Matches, MaxLength } from 'class-validator';

export class SignContractDto {
  @IsString()
  @MaxLength(500000)
  @Matches(/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/]+=*$/)
  signatureImage: string;

  @IsString()
  @MaxLength(200)
  signerName: string;
}
