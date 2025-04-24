import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISBN,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';
import * as sanitizeHtml from 'sanitize-html';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => {
    const data = sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    });

    return data.trim();
  })
  title: string;

  @ApiProperty()
  @IsInt()
  categoryId: number;

  @ApiProperty()
  @IsISBN()
  isbn: string;

  @ApiProperty()
  @IsPositive()
  price: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    const data = sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    });

    return data.trim();
  })
  description?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  stockQuantity: number;

  @ApiProperty()
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty()
  @IsBoolean()
  isActive: boolean;

  @IsEmail()
  author: string;
}
