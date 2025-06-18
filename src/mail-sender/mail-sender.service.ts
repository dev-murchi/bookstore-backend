import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

import { EmailTemplateKey, EmailTemplates } from '../common/config';
import {
  OrderStatusUpdateJob,
  PasswordResetJob,
} from '../common/types/mail-sender-queue-job.type';
import { MailConfigError } from '../common/errors/mail-config.error';
import { MailTemplateError } from '../common/errors/mail-template.error';
import { MailSendError } from '../common/errors/mail-send.error';

type TemplateContent = { subject: string; text: string; html: string };
type TemplateFields = { key: string; value: string }[];

@Injectable()
export class MailSenderService {
  private transporter: Transporter;
  private readonly templates = new Map<EmailTemplateKey, TemplateContent>();
  private readonly emailTemplates: EmailTemplates;

  private readonly mailHost: string;
  private readonly mailPort: number;
  private readonly mailAddress: string;
  private readonly mailPass: string;

  private readonly companyName: string;
  private readonly supportEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.mailHost = this.getConfig<string>('email.host');
    this.mailPort = this.getConfig<number>('email.port');
    this.mailAddress = this.getConfig<string>('email.user');
    this.mailPass = this.getConfig<string>('email.password');
    this.companyName = this.getConfig<string>('email.companyName');
    this.supportEmail = this.getConfig<string>('email.supportEmail');
    this.emailTemplates = this.getConfig<EmailTemplates>('email.templates');

    this.transporter = this.createMailTransporter();
    this.initializeTemplates();
  }

  private getConfig<T>(key: string): T {
    const value = this.configService.get<T>(key);
    if (!value) throw new MailConfigError(`Missing config value: ${key}`);
    return value;
  }

  private createMailTransporter(): Transporter {
    return createTransport({
      host: this.mailHost,
      port: this.mailPort,
      secure: true,
      auth: {
        user: this.mailAddress,
        pass: this.mailPass,
      },
    });
  }

  private readTemplateFile(fileName: string): string {
    const filePath = path.join(__dirname, '../assets/mail-templates', fileName);
    try {
      return fs.readFileSync(filePath, 'utf-8').trim();
    } catch (error) {
      throw new MailTemplateError(`Failed to read template: ${fileName}`);
    }
  }

  private loadTemplate(subject: string, fileName: string): TemplateContent {
    return {
      subject,
      text: this.readTemplateFile(`text/${fileName}.text`),
      html: this.readTemplateFile(`html/${fileName}.html`),
    };
  }

  private initializeTemplates() {
    try {
      for (const [key, { subject, fileName }] of Object.entries(
        this.emailTemplates,
      )) {
        this.templates.set(
          key as EmailTemplateKey,
          this.loadTemplate(subject, fileName),
        );
      }
    } catch (error) {
      console.error('Failed to load email templates:', error);
      throw new MailTemplateError('Failed to load email templates');
    }
  }

  private async sendMail(
    email: string,
    subject: string,
    text: string,
    html: string,
  ) {
    try {
      const info = await this.transporter.sendMail({
        from: this.mailAddress,
        to: email,
        subject,
        text,
        html,
      });

      return info;
    } catch (error) {
      console.error('Failed to send the email. Error:', error);
      throw new MailSendError('Failed to send the email');
    }
  }

  private fillTemplate(template: string, fields: TemplateFields): string {
    return fields.reduce(
      (result, { key, value }) => result.replaceAll(key, value),
      template,
    );
  }

  private async sendTemplatedEmail(
    templateKey: EmailTemplateKey,
    to: string,
    fields: TemplateFields,
  ) {
    const template = this.templates.get(templateKey);
    if (!template) {
      throw new MailTemplateError(`Template '${templateKey}' not found`);
    }

    const { subject, text, html } = template;

    if (!subject || !text || !html) {
      throw new MailTemplateError(
        `Incomplete template content for '${templateKey}'`,
      );
    }

    const dataSubject = this.fillTemplate(subject, fields);
    const dataText = this.fillTemplate(text, fields);
    const dataHtml = this.fillTemplate(html, fields);

    if (
      dataText.includes('{{') ||
      dataHtml.includes('{{') ||
      dataSubject.includes('{{')
    ) {
      console.warn(`Template '${templateKey}' contains unfilled placeholders`);
    }

    await this.sendMail(to, dataSubject, dataText, dataHtml);
  }

  async sendResetPasswordMail(data: PasswordResetJob) {
    const fields: TemplateFields = [
      { key: '{{link}}', value: data.link },
      { key: '{{customer_name}}', value: data.username },
      { key: '{{company_name}}', value: this.companyName },
      { key: '{{support_email}}', value: this.supportEmail },
    ];

    await this.sendTemplatedEmail('passwordReset', data.email, fields);
  }

  async sendOrderStatusChangeMail(
    type: EmailTemplateKey,
    data: OrderStatusUpdateJob,
  ) {
    const fields: TemplateFields = [
      { key: '{{customer_name}}', value: data.username },
      { key: '{{order_id}}', value: data.orderId },
      { key: '{{company_name}}', value: this.companyName },
      { key: '{{support_email}}', value: this.supportEmail },
    ];

    if (data.trackingId) {
      fields.push({ key: '{{tracking_id}}', value: data.trackingId });
    }

    await this.sendTemplatedEmail(type, data.email, fields);
  }
}
