import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ReviewsModule } from 'src/reviews/reviews.module';
import { OrdersModule } from 'src/orders/orders.module';
import { UserSessionService } from './user-session/user-session.service';

@Module({
  imports: [ReviewsModule, OrdersModule],
  providers: [UserService, UserSessionService],
  exports: [UserService, UserSessionService],
  controllers: [UserController],
})
export class UserModule {}
