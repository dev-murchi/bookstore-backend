import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { UserModule } from 'src/user/user.module';
import { ReviewsModule } from 'src/reviews/reviews.module';

@Module({
  imports: [UserModule, ReviewsModule],
  controllers: [BooksController],
  providers: [BooksService],
})
export class BooksModule {}
