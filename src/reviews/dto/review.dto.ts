import { IsNotEmpty, IsNumber, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewDTO {
  @ApiProperty({
    description: 'Unique identifier for the review',
    example: 101,
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'Text content of the review',
    example: 'This book was incredibly insightful and well-written.',
  })
  @IsString()
  @IsNotEmpty()
  data: string;

  @ApiProperty({
    description: 'Numeric rating between 0 and 5',
    example: 4.6,
    minimum: 0,
    maximum: 5,
  })
  @IsNumber()
  @IsNotEmpty()
  rating: number;

  @ApiProperty({
    description: 'ID of the reviewed book',
    example: '3f50a6e1-32c4-4b16-b233-a5a3f2e2b91a',
  })
  @IsString()
  @IsUUID()
  book: string;

  @ApiProperty({
    description: 'ID of the user who wrote the review',
    example: 'a94b382b-2355-4baa-bfb1-706dbce741aa',
  })
  @IsString()
  @IsUUID()
  owner: string;

  constructor(
    id: number,
    data: string,
    rating: number,
    bookId: string,
    ownerId: string,
  ) {
    this.id = id;
    this.data = data;
    this.rating = rating;
    this.book = bookId;
    this.owner = ownerId;
  }
}
