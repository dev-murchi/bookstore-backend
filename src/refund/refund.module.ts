import { Module } from '@nestjs/common';
import { RefundService } from './refund.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RefundService],
  exports: [RefundService],
})
export class RefundModule {}
