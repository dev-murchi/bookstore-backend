import { Injectable } from '@nestjs/common';
import { MailTemplateService } from './mail-template/mail-template.service';
import { NodemailerService } from './nodemailer/nodemailer.service';
import {
  EmailTemplateField,
  EmailTemplateKey,
} from '../common/types/email-config.type';
import { MailTemplateError } from '../common/errors/mail-template.error';

@Injectable()
export class MailService {
  constructor(
    private readonly mailTemplateService: MailTemplateService,
    private readonly nodeMailerService: NodemailerService,
  ) {}

  async sendTemplatedEmail(
    templateKey: EmailTemplateKey,
    to: string,
    fields: EmailTemplateField[],
  ) {
    // get template
    const template = this.mailTemplateService.getTemplate(templateKey);
    if (!template) {
      throw new MailTemplateError(`Template '${templateKey}' not found`);
    }

    // extract subject, text and html from template
    const { subject, text, html } = template;
    if (!subject || !text || !html) {
      throw new MailTemplateError(
        `Incomplete template content for '${templateKey}'`,
      );
    }

    // fill template contents of the subject, text and html
    const dataSubject = this.mailTemplateService.fillMailTemplateContent(
      subject,
      fields,
    );
    const dataText = this.mailTemplateService.fillMailTemplateContent(
      text,
      fields,
    );
    const dataHtml = this.mailTemplateService.fillMailTemplateContent(
      html,
      fields,
    );

    // check unfilled templates
    if (
      dataText.includes('{{') ||
      dataHtml.includes('{{') ||
      dataSubject.includes('{{')
    ) {
      console.warn(`Template '${templateKey}' contains unfilled placeholders`);
    }

    // send email
    await this.nodeMailerService.sendMail(to, dataSubject, dataText, dataHtml);
  }
}
