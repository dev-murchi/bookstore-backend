import { IsNotEmpty, IsNumber, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewDTO {
  @ApiProperty({
    description: 'Unique identifier for the review',
    example: 'review-uuid-1',
  })
  @IsUUID()
  id: string;

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
    example: 'a1b2c3d4-e5f6-7890-ab12-cd34ef56gh78',
  })
  @IsString()
  @IsUUID()
  book: string;

  @ApiProperty({
    description: 'ID of the user who wrote the review',
    example: 'abcdef01-2345-6789-abcd-ef0123456789',
  })
  @IsString()
  @IsUUID()
  owner: string;

  constructor(
    id: string,
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
