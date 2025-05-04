import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UserController } from './user.controller';
import { Password } from 'src/common/password';

@Module({
  imports: [PrismaModule],
  providers: [UserService, Password],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
