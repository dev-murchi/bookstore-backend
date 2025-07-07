export type Template = {
  subject: string;
  fileName: string;
};

export type EmailTemplates = {
  authPasswordReset: Template;
  refundCreated: Template;
  refundComplete: Template;
  refundFailed: Template;
  orderPending: Template;
  orderComplete: Template;
  orderShipped: Template;
  orderDelivered: Template;
  orderCanceled: Template;
  orderExpired: Template;
  orderReturned: Template;
};

export type EmailTemplateKey = keyof EmailTemplates;

export type RefundEmailTemplateKey = Extract<
  EmailTemplateKey,
  `refund${string}`
>;

export type OrderEmailTemplateKey = Extract<EmailTemplateKey, `order${string}`>;

export type AuthEmailTemplateKey = Extract<EmailTemplateKey, `auth${string}`>;

export type EmailConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  companyName: string;
  supportEmail: string;
  templates: EmailTemplates;
};

export type EmailTemplateField = { key: string; value: string };
