export type Template = {
  subject: string;
  fileName: string;
};

export type EmailTemplates = {
  passwordReset: Template;
  refundCreated: Template;
  refundComplete: Template;
  refundFailed: Template;
  orderPending: Template;
  orderComplete: Template;
  orderShipped: Template;
  orderDelivered: Template;
  orderCanceled: Template;
  orderExpired: Template;
};

export type EmailTemplateKey = keyof EmailTemplates;

export type EmailConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  companyName: string;
  supportEmail: string;
  templates: EmailTemplates;
};
