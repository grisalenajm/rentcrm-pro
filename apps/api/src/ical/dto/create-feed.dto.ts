import { IsString, IsUrl, IsIn } from 'class-validator';

export class CreateFeedDto {
  @IsString()
  propertyId: string;

  @IsUrl()
  url: string;

  @IsIn(['airbnb', 'booking', 'other'])
  platform: string;
}
