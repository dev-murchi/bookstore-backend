import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsStrongPassword,
  IsOptional,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  @IsOptional()
  email: string;

  @ApiProperty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
  })
  @IsString()
  password: string;

  @ApiProperty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
  })
  @IsOptional()
  newPassword: string;
}
