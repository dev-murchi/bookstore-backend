// import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class BookFilterDTO {
  @ApiPropertyOptional({ type: Number, description: 'Minimum price' })
  @IsOptional()
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num)) {
      throw new HttpException(
        'minPrice must be a number',
        HttpStatus.NOT_ACCEPTABLE,
      );
    }
    return num;
  })
  readonly minPrice?: number;

  @ApiPropertyOptional({ type: Number, description: 'Maximum price' })
  @IsOptional()
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num)) {
      throw new HttpException(
        'maxPrice must be a number',
        HttpStatus.NOT_ACCEPTABLE,
      );
    }
    return num;
  })
  readonly maxPrice?: number;

  @ApiPropertyOptional({ type: Number, description: 'Minimum rating [0–5]' })
  @IsOptional()
  @Transform(({ value }) => {
    const num = Number(value);
    if (isNaN(num) || num > 5 || num < 0) {
      throw new HttpException(
        'rating must be a number and between [0, 5]',
        HttpStatus.NOT_ACCEPTABLE,
      );
    }

    return num;
  })
  readonly rating?: number;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Filter by stock availability',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  readonly stock?: boolean;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], description: 'Sort order' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  readonly sort?: 'asc' | 'desc';
}
