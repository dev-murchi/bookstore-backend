import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';

@Module({
  imports: [PrismaModule, JwtModule, UserModule],
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}
