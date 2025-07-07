import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/user/user.module';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [UserModule, QueueModule],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenStrategy, JwtStrategy],
})
export class AuthModule {}
