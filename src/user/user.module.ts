import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UserController } from './user.controller';
import { ReviewsModule } from 'src/reviews/reviews.module';
import { OrdersModule } from 'src/orders/orders.module';

@Module({
  imports: [PrismaModule, ReviewsModule, OrdersModule],
  providers: [UserService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
