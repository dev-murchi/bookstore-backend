import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailSenderService {
  private transporter: Transporter;
  private mailHost: string;
  private mailPort: number;
  private mailAddress: string;
  private mailPass: string;

  private readonly htmlMessages = new Map<string, string>();
  private readonly textMessages = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {
    this.mailHost = this.configService.get<string>('email.host');
    this.mailPort = this.configService.get<number>('email.port');
    this.mailAddress = this.configService.get<string>('email.user');
    this.mailPass = this.configService.get<string>('email.password');

    if (
      !this.mailHost ||
      !this.mailPort ||
      !this.mailAddress ||
      !this.mailPass
    ) {
      throw new Error('Mail configuration missing.');
    }

    this.transporter = createTransport({
      host: this.mailHost,
      port: this.mailPort,
      secure: true,
      auth: {
        user: this.mailAddress,
        pass: this.mailPass,
      },
    });

    try {
      this.readMaileMessageTemplates('password-reset');
      this.readMaileMessageTemplates('refund-create');
      this.readMaileMessageTemplates('refund-complete');
      this.readMaileMessageTemplates('refund-failed');
    } catch (error) {
      console.error('Failed to load email templates:', error);
      throw new Error(
        'Failed to initialize email service: Could not load templates.',
      );
    }
  }

  private readMaileMessageTemplates(fileName: string) {
    const mailFolderPath = path.join(__dirname, '../assets/mail-templates');
    try {
      this.htmlMessages.set(
        fileName,
        fs
          .readFileSync(
            path.join(mailFolderPath, `html/${fileName}.html`),
            'utf8',
          )
          .trim(),
      );

      this.textMessages.set(
        fileName,
        fs
          .readFileSync(
            path.join(mailFolderPath, `text/${fileName}.text`),
            'utf8',
          )
          .trim(),
      );
    } catch (error) {
      console.error(`Error reading mail template ${fileName}:`, error);
      throw new Error(`Failed to read mail template: ${fileName}`);
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
      throw new Error('Failed to send the email');
    }
  }

  async sendResetPasswordMail(email: string, username: string, link: string) {
    try {
      const subject = 'Reset your password';
      await this.updateFieldsAndSendMail('password-reset', email, subject, [
        { key: '{{link}}', value: link },
      ]);
    } catch (error) {
      console.error('Failed to send password reset email. Error:', error);
      throw new Error('Failed to send password reset email.');
    }
  }

  async sendOrderStatusUpdateMail(
    email: string,
    orderId: string,
    status: string,
  ) {
    try {
      if (status === 'shipped') {
        await this.sendMail(
          email,
          `Your Books are on Their Way! Order #${orderId}`,
          'book are shipped',
          '<p>books are shipped</p>',
        );
      } else if (status === 'delivered') {
        await this.sendMail(
          email,
          `Your Book Order #${orderId} Has Arrived!`,
          'book are delivered',
          '<p>books are delivered</p>',
        );
      } else {
        throw new Error(
          'Invalid order status provided for email notification.',
        );
      }
    } catch (error) {
      console.error(
        `Failed to send order status update email for Order ${orderId}. Error:`,
        error,
      );
      throw new Error(
        `Failed to send order status update email for Order ${orderId}.`,
      );
    }
  }

  async sendRefundCreatedMail(data: {
    orderId: string;
    amount: string;
    email: string;
    customerName: string;
  }) {
    try {
      const { orderId, amount, email, customerName } = data;
      const subject = 'We’ve initiated your refund';
      await this.updateFieldsAndSendMail('refund-create', email, subject, [
        { key: '{{customer_name}}', value: customerName },
        { key: '{{order_id}}', value: orderId },
        { key: '{{amount}}', value: amount },
      ]);
    } catch (error) {
      console.error(
        `Failed to send refund created email for Order ${data.orderId}. Error:`,
        error,
      );
      throw new Error(
        `Failed to send refund created email for Order ${data.orderId}.`,
      );
    }
  }

  async sendRefundCompletedMail(data: {
    orderId: string;
    amount: string;
    email: string;
    customerName: string;
  }) {
    try {
      const { orderId, amount, email, customerName } = data;
      const subject = 'Your refund has been completed';
      await this.updateFieldsAndSendMail('refund-complete', email, subject, [
        { key: '{{customer_name}}', value: customerName },
        { key: '{{order_id}}', value: orderId },
        { key: '{{amount}}', value: amount },
      ]);
    } catch (error) {
      console.error(
        `Failed to send refund completed email for Order ${data.orderId}. Error:`,
        error,
      );
      throw new Error(
        `Failed to send refund completed email for Order ${data.orderId}.`,
      );
    }
  }

  async sendRefundFailedMail(data: {
    email: string;
    orderId: string;
    customerName: string;
    amount: string;
    failureReason: string;
  }) {
    try {
      const { orderId, amount, email, customerName, failureReason } = data;
      const subject = 'There was a problem with your refund';
      await this.updateFieldsAndSendMail('refund-failed', email, subject, [
        { key: '{{customer_name}}', value: customerName },
        { key: '{{order_id}}', value: orderId },
        { key: '{{amount}}', value: amount },
        { key: '{{failure_reason}}', value: failureReason },
      ]);
    } catch (error) {
      console.error(
        `Failed to send refund failed email for Order ${data.orderId}. Error:`,
        error,
      );
      throw new Error(
        `Failed to send refund failed email for Order ${data.orderId}.`,
      );
    }
  }

  private async updateFieldsAndSendMail(
    fileName: string,
    email: string,
    subject: string,
    fileds: { key: string; value: string }[],
  ) {
    const dataHtml = fileds.reduce((text, field) => {
      return text.replaceAll(field.key, field.value);
    }, this.htmlMessages.get(fileName));

    const dataText = fileds.reduce((text, field) => {
      return text.replaceAll(field.key, field.value);
    }, this.textMessages.get(fileName));

    if (!dataHtml || !dataText) {
      console.warn(`Missing email templates for fileName: ${fileName}`);
      throw new Error(`Email template content missing for ${fileName}`);
    }

    await this.sendMail(email, subject, dataText, dataHtml);
  }
}
