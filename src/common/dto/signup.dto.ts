import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from 'class-validator';

export class SignupDTO {
  @ApiProperty({
    description: 'Email of the new user',
    example: 'saruman@isengard.net',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Password for the new user',
    example: 'VoiceOfPower@1',
  })
  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
  })
  password: string;

  @ApiProperty({
    description: 'Full name of the new user',
    example: 'Saruman the White',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}
