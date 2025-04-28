import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
