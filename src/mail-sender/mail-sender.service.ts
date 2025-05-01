import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class MailSenderService {
  private transporter: Transporter;
  private mailHost: string;
  private mailPort: number;
  private mailAddress: string;
  private mailPass: string;

  constructor(private readonly configService: ConfigService) {
    this.mailHost = this.configService.get<string>('MAIL_HOST');
    this.mailPort = this.configService.get<number>('MAIL_PORT');
    this.mailAddress = this.configService.get<string>('MAIL_ADDRESS');
    this.mailPass = this.configService.get<string>('MAIL_PASS');

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
  }

  private resetPasswordText(link: string) {
    const text = `
Hi there!

We received a request to reset the password for your BookStore account.
If you made this request, please use the link below to reset your password.

Link: ${link}

Note that this link can only be used once and will expire in 10 minutes. After the time limit has expired, you will have to resubmit the request for a password reset. If you didn’t request a password reset, please ignore this email.
  
For any further assistance, feel free to mail us at support@bookstore.com.

Technical Team of BookStore`;

    return text.trim();
  }

  private resetPasswordHtml(link: string) {
    const html = `
<div style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px;">
    <!-- Header -->
    <div style="text-align: center; padding: 20px;">
      <img src="" alt="BookStore Logo" style="width: 150px;">
    </div>

    <!-- Content -->
    <div style="padding: 20px; color: #333333;">
      <p style="font-size: 16px; line-height: 1.6;">Hi there!</p>
      <p style="font-size: 16px; line-height: 1.6;">We received a request to reset the password for your BookStore
        account.</p>
      <p style="font-size: 16px; line-height: 1.6;">If you made this request, please click the button below to reset
        your password.</p>

      <p style="text-align: center;">
        <a href="${link}"
          style="background-color: #007bff; color: #ffffff; padding: 15px 30px; text-align: center; text-decoration: none; display: inline-block; border-radius: 5px; font-size: 16px;">Reset
          Password</a>
      </p>

      <p style="font-size: 16px; line-height: 1.6;">If the above link does not work for you, please copy and paste the
        following into your browser address bar:</p>

      <p style="font-size: 16px; line-height: 1.6;">${link}</p>

      <p style="font-size: 16px; line-height: 1.6;">Note that this link can only be used once and will expire in 10 minutes. After the time limit has
        expired, you will have to resubmit the request for a password reset.</p>
      <p style="font-size: 16px; line-height: 1.6;">If you didn’t request a password reset, please ignore this email.
      </p>

      <p style="font-size: 16px; line-height: 1.6;">For any further assistance, feel free to mai us at
        <a href="mailto:support@bookstore.com">support@bookstore.com</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; font-size: 14px; color: #777777; margin-top: 20px;">
      <p>&copy; 2025 BookStore. All rights reserved.</p>
    </div>
  </div>
</div>`.trim();

    return html.trim();
  }

  async sendMail(email: string, subject: string, text: string, html: string) {
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
    await this.sendMail(
      email,
      'Reset your password',
      this.resetPasswordText(link),
      this.resetPasswordHtml(link),
    );
  }

  async sendOrderStatusUpdateMail(
    email: string,
    orderId: number,
    status: string,
  ) {
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
      throw new Error('Invalid order status');
    }
  }
}
