import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template/mail-template.service';
import { NodemailerService } from './nodemailer/nodemailer.service';

@Module({
  providers: [MailService, MailTemplateService, NodemailerService],
  exports: [MailService],
})
export class MailModule {}
