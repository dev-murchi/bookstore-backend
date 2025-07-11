import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { MailConfigError } from 'src/common/errors/mail-config.error';
import { MailSendError } from 'src/common/errors/mail-send.error';

@Injectable()
export class NodemailerService {
  private transporter: Transporter;

  private readonly mailHost: string;
  private readonly mailPort: number;
  private readonly mailAddress: string;
  private readonly mailPass: string;

  constructor(private readonly configService: ConfigService) {
    this.mailHost = this.getConfig<string>('email.host');
    this.mailPort = this.getConfig<number>('email.port');
    this.mailAddress = this.getConfig<string>('email.user');
    this.mailPass = this.getConfig<string>('email.password');
    this.transporter = this.createMailTransporter();
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
      throw new MailSendError('Failed to send the email');
    }
  }
}
