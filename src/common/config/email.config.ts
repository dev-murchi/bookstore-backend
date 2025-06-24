import { registerAs } from '@nestjs/config';
import { EmailConfig } from '../types/email-config.type';

const config: EmailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: Number.parseInt(process.env.EMAIL_PORT, 10) || 587,
  user: process.env.EMAIL_USER || 'your@email.com',
  password: process.env.EMAIL_PASS || 'your_password',
  companyName: process.env.COMPANY_NAME || 'Book Store',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@bookstore.com',
  templates: {
    authPasswordReset: {
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
    orderPending: {
      subject: 'Your Order Has Been Received - {{company_name}}',
      fileName: 'order-pending',
    },
    orderComplete: {
      subject: 'Your Order #{{order_id}} Is Complete – Enjoy Your Books!',
      fileName: 'order-complete',
    },
    orderShipped: {
      subject: 'Your Order #{{order_id}} Has Shipped – Track It Now',
      fileName: 'order-shipped',
    },
    orderDelivered: {
      subject: 'Your Order #{{order_id}} Was Delivered – Happy Reading!',
      fileName: 'order-delivered',
    },
    orderCanceled: {
      subject: 'Your Order #{{order_id}} Has Been Canceled',
      fileName: 'order-canceled',
    },
    orderExpired: {
      subject: 'Order #{{order_id}} Expired – Time to Reorder Your Books',
      fileName: 'order-expired',
    },
    orderReturned: {
      subject: 'Return Confirmation for Order #{{order_id}}',
      fileName: 'order-returned',
    },
  },
};

export const emailConfig = registerAs('email', () => config);
