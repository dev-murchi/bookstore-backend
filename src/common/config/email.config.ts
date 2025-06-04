import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: Number.parseInt(process.env.EMAIL_PORT, 10) || 587,
  user: process.env.EMAIL_USER || 'your@email.com',
  password: process.env.EMAIL_PASS || 'your_password',
  companyName: process.env.COMPANY_NAME || 'Book Store',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@bookstore.com',
  templates: {
    passwordReset: {
      subject: 'Reset your password',
      fileName: 'password-reset',
    },
    refundCreated: {
      subject: 'Refund Initiated for Order #{{order_id}} – {{company_name}}',
      fileName: 'refund-create',
    },
    refundComplete: {
      subject: 'Refund Completed for Order #{{order_id}}',
      fileName: 'refund-complete',
    },
    refundFailed: {
      subject: 'Refund Attempt Failed for Order #{{order_id}}',
      fileName: 'refund-failed',
    },
  },
}));

export type EmailConfigType = ReturnType<typeof emailConfig>;

export type EmailTemplates = EmailConfigType['templates'];

export type EmailTemplateKey = keyof EmailTemplates;
