import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from 'src/user/user.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmailModule } from 'src/email/email.module';
import { Password } from 'src/common/password';

@Module({
  imports: [UserModule, PrismaModule, EmailModule],
  controllers: [AuthController],
  providers: [AuthService, Password],
})
export class AuthModule {}
