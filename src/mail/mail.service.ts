import { Injectable } from '@nestjs/common';
import { MailTemplateService } from './mail-template/mail-template.service';
import { NodemailerService } from './nodemailer/nodemailer.service';
import { EmailTemplateKey } from '../common/types/email-config.type';
import { MailTemplateError } from '../common/errors/mail-template.error';
import { ConfigService } from '@nestjs/config';
import { MailConfigError } from '../common/errors/mail-config.error';

@Injectable()
export class MailService {
  private readonly supportEmail: string;
  private readonly companyName: string;
  constructor(
    private readonly mailTemplateService: MailTemplateService,
    private readonly nodeMailerService: NodemailerService,
    private readonly configService: ConfigService,
  ) {
    this.supportEmail = this.getConfig<string>('email.supportEmail');
    this.companyName = this.getConfig<string>('email.companyName');
  }

  private getConfig<T>(key: string): T {
    const value = this.configService.get<T>(key);
    if (!value) throw new MailConfigError(`Missing config value: ${key}`);
    return value;
  }
  async sendTemplatedEmail(
    templateKey: EmailTemplateKey,
    to: string,
    templateFields: Map<string, string>,
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

    // clone the original map
    const updatedFields = new Map(templateFields);

    if (!updatedFields.has('{{company_name}}')) {
      updatedFields.set('{{company_name}}', this.companyName);
    }

    if (!updatedFields.has('{{support_email}}')) {
      updatedFields.set('{{support_email}}', this.supportEmail);
    }

    // fill template contents of the subject, text and html
    const dataSubject = this.mailTemplateService.fillMailTemplateContent(
      subject,
      updatedFields,
    );
    const dataText = this.mailTemplateService.fillMailTemplateContent(
      text,
      updatedFields,
    );
    const dataHtml = this.mailTemplateService.fillMailTemplateContent(
      html,
      updatedFields,
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
