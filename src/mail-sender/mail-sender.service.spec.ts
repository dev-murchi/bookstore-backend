import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailSenderService } from './mail-sender.service';
import { createTransport } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { MailConfigError } from '../common/errors/mail-config.error';
import { MailTemplateError } from '../common/errors/mail-template.error';
import { MailSendError } from '../common/errors/mail-send.error';
import { EmailTemplateKey } from 'src/common/types/email-config.type';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
  })),
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockImplementation((filePath) => {
    if (filePath.includes('password-reset.text')) {
      return mockPasswordResetTemplate.text;
    }
    if (filePath.includes('password-reset.html')) {
      return mockPasswordResetTemplate.html;
    }
    if (filePath.includes('order-placed.text')) {
      return mockOrderPlacedTemplate.text;
    }
    if (filePath.includes('order-placed.html')) {
      return mockOrderPlacedTemplate.html;
    }
    if (filePath.includes('order-shipped.text')) {
      return mockOrderShippedTemplate.text;
    }
    if (filePath.includes('order-shipped.html')) {
      return mockOrderShippedTemplate.html;
    }
    return ''; // Default empty string
  }),
}));

jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn().mockImplementation((...args) => {
    const fullPath = args.join('/');
    if (fullPath.includes('password-reset.text')) {
      return 'path/to/text/password-reset.text';
    }
    if (fullPath.includes('password-reset.html')) {
      return 'path/to/html/password-reset.html';
    }
    if (fullPath.includes('order-placed.text')) {
      return 'path/to/text/order-placed.text';
    }
    if (fullPath.includes('order-placed.html')) {
      return 'path/to/html/order-placed.html';
    }
    if (fullPath.includes('order-shipped.text')) {
      return 'path/to/text/order-shipped.text';
    }
    if (fullPath.includes('order-shipped.html')) {
      return 'path/to/html/order-shipped.html';
    }
    return fullPath; // Default for other cases
  }),
}));

const mockTransporter = {
  sendMail: jest.fn(),
};

const mockMailConfig = {
  email: {
    host: 'smtp.test.com',
    port: 587,
    user: 'test@example.com',
    password: 'password',
    companyName: 'Test Company',
    supportEmail: 'support@test.com',
    templates: {
      passwordReset: {
        subject: 'Reset Your Password - {{company_name}}',
        fileName: 'password-reset',
      },
      orderPlaced: {
        subject: 'Order Placed! - {{company_name}}',
        fileName: 'order-placed',
      },
      orderShipped: {
        subject: 'Your Order Has Shipped! - {{company_name}}',
        fileName: 'order-shipped',
      },
    },
  },
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'email.host') return mockMailConfig.email.host;
    if (key === 'email.port') return mockMailConfig.email.port;
    if (key === 'email.user') return mockMailConfig.email.user;
    if (key === 'email.password') return mockMailConfig.email.password;
    if (key === 'email.companyName') return mockMailConfig.email.companyName;
    if (key === 'email.supportEmail') return mockMailConfig.email.supportEmail;
    if (key === 'email.templates') return mockMailConfig.email.templates;
    return undefined; // For missing config
  }),
};

const mockPasswordResetTemplate = {
  text: 'Hello {{customer_name}},\n\nReset your password here: {{link}}\n\nRegards,\n{{company_name}} Support\n{{support_email}}',
  html: '<p>Hello {{customer_name}},</p><p>Reset your password here: <a href="{{link}}">Reset Link</a></p><p>Regards,<br>{{company_name}} Support<br>{{support_email}}</p>',
};

const mockOrderPlacedTemplate = {
  subject: 'Order Placed! - {{company_name}}',
  text: 'Hello {{customer_name}},\n\nYour order {{order_id}} has been placed.\n\nRegards,\n{{company_name}} Support\n{{support_email}}',
  html: '<p>Hello {{customer_name}},</p><p>Your order {{order_id}} has been placed.</p><p>Regards,<br>{{company_name}} Support<br>{{support_email}}</p>',
};

const mockOrderShippedTemplate = {
  subject: 'Your Order Has Shipped! - {{company_name}}',
  text: 'Hello {{customer_name}},\n\nYour order {{order_id}} has been shipped. Tracking ID: {{tracking_id}}\n\nRegards,\n{{company_name}} Support\n{{support_email}}',
  html: '<p>Hello {{customer_name}},</p><p>Your order {{order_id}} has been shipped. Tracking ID: {{tracking_id}}</p><p>Regards,<br>{{company_name}} Support<br>{{support_email}}</p>',
};

describe('MailSenderService', () => {
  let service: MailSenderService;
  let configService: ConfigService;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(async () => {
    (createTransport as jest.Mock).mockClear();
    (createTransport as jest.Mock).mockReturnValue(mockTransporter);
    mockTransporter.sendMail.mockClear();
    (fs.readFileSync as jest.Mock).mockClear();
    (path.join as jest.Mock).mockClear();
    mockConfigService.get.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailSenderService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();
    service = module.get<MailSenderService>(MailSenderService);
    configService = module.get<ConfigService>(ConfigService);

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Constructor and Initialization', () => {
    it('should throw MailConfigError if a required config is missing during getConfig', async () => {
      const testModule = Test.createTestingModule({
        providers: [
          MailSenderService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'email.host') return undefined;
                if (key === 'email.port') return mockMailConfig.email.port;
                if (key === 'email.user') return mockMailConfig.email.user;
                if (key === 'email.password')
                  return mockMailConfig.email.password;
                if (key === 'email.companyName')
                  return mockMailConfig.email.companyName;
                if (key === 'email.supportEmail')
                  return mockMailConfig.email.supportEmail;
                if (key === 'email.templates')
                  return mockMailConfig.email.templates;
                return undefined;
              }),
            },
          },
        ],
      });
      try {
        await testModule.compile();
      } catch (error) {
        expect(error).toBeInstanceOf(MailConfigError);
        expect(error.message).toBe('Missing config value: email.host');
      }
    });

    it('should throw MailTemplateError if template reading fails during initializeTemplates', async () => {
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('File read error');
      });

      const testModule = Test.createTestingModule({
        providers: [
          MailSenderService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'email.host') return mockMailConfig.email.host;
                if (key === 'email.port') return mockMailConfig.email.port;
                if (key === 'email.user') return mockMailConfig.email.user;
                if (key === 'email.password')
                  return mockMailConfig.email.password;
                if (key === 'email.companyName')
                  return mockMailConfig.email.companyName;
                if (key === 'email.supportEmail')
                  return mockMailConfig.email.supportEmail;
                if (key === 'email.templates')
                  return mockMailConfig.email.templates;
                return undefined;
              }),
            },
          },
        ],
      });
      await expect(testModule.compile()).rejects.toThrow(MailTemplateError);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load email templates:',
        expect.any(Error),
      );
    });

    it('should initialize the transporter and templates successfully', () => {
      expect(configService.get).toHaveBeenCalledWith('email.host');
      expect(configService.get).toHaveBeenCalledWith('email.port');
      expect(configService.get).toHaveBeenCalledWith('email.user');
      expect(configService.get).toHaveBeenCalledWith('email.password');
      expect(configService.get).toHaveBeenCalledWith('email.companyName');
      expect(configService.get).toHaveBeenCalledWith('email.supportEmail');
      expect(configService.get).toHaveBeenCalledWith('email.templates');
      expect(createTransport).toHaveBeenCalledWith({
        host: mockMailConfig.email.host,
        port: mockMailConfig.email.port,
        secure: true,
        auth: {
          user: mockMailConfig.email.user,
          pass: mockMailConfig.email.password,
        },
      });

      expect(fs.readFileSync).toHaveBeenCalledTimes(6);
    });
  });

  describe('readTemplateFile', () => {
    it('should throw MailTemplateError if file reading fails', () => {
      const filePath = 'path/to/non-existent-file.txt';
      (path.join as jest.Mock).mockReturnValueOnce(filePath);
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      expect(() =>
        service['readTemplateFile']('non-existent-file.txt'),
      ).toThrow(MailTemplateError);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should read a template file successfully', () => {
      const filePath = 'path/to/some/file.txt';
      const fileContent = 'Some content';
      (path.join as jest.Mock).mockReturnValueOnce(filePath);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(fileContent);

      const result = service['readTemplateFile']('some-file.txt');
      expect(path.join).toHaveBeenCalledWith(
        expect.any(String),
        '../assets/mail-templates',
        'some-file.txt',
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(filePath, 'utf-8');
      expect(result).toBe(fileContent);
    });
  });

  describe('loadTemplate', () => {
    it('should throw MailTemplateError from readTemplateFile', () => {
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new MailTemplateError('Failed to read text template');
      });

      expect(() => service['loadTemplate']('Sub', 'file')).toThrow(
        MailTemplateError,
      );
    });
    it('should load a template successfully', () => {
      const subject = 'Test Subject';
      const fileName = 'test-template';
      const textContent = 'Text content';
      const htmlContent = 'Html content';

      (fs.readFileSync as jest.Mock)
        .mockReturnValueOnce(textContent)
        .mockReturnValueOnce(htmlContent);

      const result = service['loadTemplate'](subject, fileName);
      expect(result).toEqual({
        subject,
        text: textContent,
        html: htmlContent,
      });
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining(`text/${fileName}.text`),
        'utf-8',
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining(`html/${fileName}.html`),
        'utf-8',
      );
    });
  });

  describe('sendMail', () => {
    it('should throw MailSendError if sending fails and log the error', async () => {
      const sendError = new Error('Network error');
      mockTransporter.sendMail.mockRejectedValueOnce(sendError);
      await expect(
        service['sendMail']('recipient@test.com', 'Sub', 'Text', 'HTML'),
      ).rejects.toThrow(MailSendError);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send the email. Error:',
        sendError,
      );
    });

    it('should send an email successfully', async () => {
      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: 'abc',
      });
      const result = await service['sendMail'](
        'recipient@test.com',
        'Subject',
        'Text',
        'HTML',
      );
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: mockMailConfig.email.user,
        to: 'recipient@test.com',
        subject: 'Subject',
        text: 'Text',
        html: 'HTML',
      });
      expect(result).toEqual({ messageId: 'abc' });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('fillTemplate', () => {
    it('should replace all placeholders correctly', () => {
      const template = 'Hello {{name}}, your order {{id}} is {{status}}.';
      const fields = [
        { key: '{{name}}', value: 'John Doe' },
        { key: '{{id}}', value: '12345' },
        { key: '{{status}}', value: 'shipped' },
      ];
      const result = service['fillTemplate'](template, fields);
      expect(result).toBe('Hello John Doe, your order 12345 is shipped.');
    });

    it('should handle templates with no placeholders', () => {
      const template = 'Static content.';
      const fields = [{ key: '{{name}}', value: 'John' }];
      const result = service['fillTemplate'](template, fields);
      expect(result).toBe('Static content.');
    });

    it('should handle fields not present in the template', () => {
      const template = 'Hello {{name}}.';
      const fields = [
        { key: '{{name}}', value: 'John' },
        { key: '{{age}}', value: '30' },
      ];
      const result = service['fillTemplate'](template, fields);
      expect(result).toBe('Hello John.');
    });
  });

  describe('sendTemplatedEmail', () => {
    let mockSendMail: jest.SpyInstance;
    let mockFillTemplate: jest.SpyInstance;

    beforeEach(() => {
      mockSendMail = jest.spyOn(service as any, 'sendMail');
      mockFillTemplate = jest.spyOn(service as any, 'fillTemplate');
      mockSendMail.mockResolvedValue({});
    });

    afterEach(() => {
      mockSendMail.mockRestore();
      mockFillTemplate.mockRestore();
    });

    it('should throw MailTemplateError if template is not found', async () => {
      const templateKey = 'nonExistentTemplate' as EmailTemplateKey;
      const to = 'test@example.com';
      const fields = [];

      await expect(
        service['sendTemplatedEmail'](templateKey, to, fields),
      ).rejects.toThrow(MailTemplateError);
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw MailTemplateError if template content is incomplete (missing html)', async () => {
      service['templates'].set('incompleteTemplate' as EmailTemplateKey, {
        subject: 'Incomplete Subject',
        text: 'Incomplete Text',
        html: '',
      });

      const templateKey = 'incompleteTemplate' as EmailTemplateKey;
      const to = 'test@example.com';
      const fields = [];

      await expect(
        service['sendTemplatedEmail'](templateKey, to, fields),
      ).rejects.toThrow(MailTemplateError);
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      service['templates'].delete('incompleteTemplate' as EmailTemplateKey);
    });

    it('should throw MailTemplateError if template content is incomplete (missing text)', async () => {
      service['templates'].set('incompleteTemplate2' as EmailTemplateKey, {
        subject: 'Incomplete Subject',
        text: '',
        html: 'Some HTML',
      });

      const templateKey = 'incompleteTemplate2' as EmailTemplateKey;
      const to = 'test@example.com';
      const fields = [];

      await expect(
        service['sendTemplatedEmail'](templateKey, to, fields),
      ).rejects.toThrow(MailTemplateError);
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      service['templates'].delete('incompleteTemplate2' as EmailTemplateKey);
    });

    it('should throw MailTemplateError if template content is incomplete (missing subject)', async () => {
      service['templates'].set('incompleteTemplate3' as EmailTemplateKey, {
        subject: '',
        text: 'Some Text',
        html: 'Some HTML',
      });

      const templateKey = 'incompleteTemplate3' as EmailTemplateKey;
      const to = 'test@example.com';
      const fields = [];

      await expect(
        service['sendTemplatedEmail'](templateKey, to, fields),
      ).rejects.toThrow(MailTemplateError);
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      service['templates'].delete('incompleteTemplate3' as EmailTemplateKey);
    });

    it('should log a warning if placeholders remain unfilled', async () => {
      const templateKey = 'passwordReset';
      const to = 'test@example.com';
      const fields = [
        { key: '{{customer_name}}', value: 'Test User' },
        // Missing {{link}} intentionally
      ];

      await service['sendTemplatedEmail'](templateKey, to, fields);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Template 'passwordReset' contains unfilled placeholders`,
      );
      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should send a templated email successfully', async () => {
      const templateKey = 'passwordReset';
      const to = 'test@example.com';
      const fields = [
        { key: '{{link}}', value: 'http://reset.com' },
        { key: '{{customer_name}}', value: 'Test User' },
        { key: '{{company_name}}', value: 'Test Company' },
        { key: '{{support_email}}', value: 'support@test.com' },
      ];

      await service['sendTemplatedEmail'](templateKey, to, fields);

      expect(mockFillTemplate).toHaveBeenCalledTimes(3);
      expect(mockFillTemplate).toHaveBeenCalledWith(
        mockMailConfig.email.templates.passwordReset.subject,
        fields,
      );
      expect(mockFillTemplate).toHaveBeenCalledWith(
        mockPasswordResetTemplate.text,
        fields,
      );
      expect(mockFillTemplate).toHaveBeenCalledWith(
        mockPasswordResetTemplate.html,
        fields,
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        to,
        expect.stringContaining('Reset Your Password - Test Company'),
        expect.stringContaining('Hello Test User'),
        expect.stringContaining('Hello Test User'),
      );
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendResetPasswordMail', () => {
    let mockSendTemplatedEmail: jest.SpyInstance;

    beforeEach(() => {
      mockSendTemplatedEmail = jest.spyOn(service as any, 'sendTemplatedEmail');
      mockSendTemplatedEmail.mockResolvedValue({});
    });

    afterEach(() => {
      mockSendTemplatedEmail.mockRestore();
    });

    it('should call sendTemplatedEmail with correct arguments', async () => {
      const data = {
        email: 'user@example.com',
        link: 'http://reset.link',
        username: 'Test User',
      };

      await service.sendResetPasswordMail(data);

      expect(mockSendTemplatedEmail).toHaveBeenCalledWith(
        'passwordReset',
        data.email,
        [
          { key: '{{link}}', value: data.link },
          { key: '{{customer_name}}', value: data.username },
          {
            key: '{{company_name}}',
            value: mockMailConfig.email.companyName,
          },
          {
            key: '{{support_email}}',
            value: mockMailConfig.email.supportEmail,
          },
        ],
      );
    });

    it('should throw errors from sendTemplatedEmail', async () => {
      const data = {
        email: 'user@example.com',
        link: 'http://reset.link',
        username: 'Test User',
      };
      const error = new MailSendError('Failed to send email');
      mockSendTemplatedEmail.mockRejectedValueOnce(error);

      await expect(service.sendResetPasswordMail(data)).rejects.toThrow(error);
      expect(mockSendTemplatedEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendOrderStatusChangeMail', () => {
    let mockSendTemplatedEmail: jest.SpyInstance;

    beforeEach(() => {
      mockSendTemplatedEmail = jest.spyOn(service as any, 'sendTemplatedEmail');
      mockSendTemplatedEmail.mockResolvedValue({});
    });

    afterEach(() => {
      mockSendTemplatedEmail.mockRestore();
    });

    it('should call sendTemplatedEmail with correct arguments for orderPlaced without trackingId', async () => {
      const data = {
        email: 'user@example.com',
        username: 'Test User',
        orderId: 'ORD123',
        trackingId: undefined,
      };
      const type = 'orderPlaced' as EmailTemplateKey;

      await service.sendOrderStatusChangeMail(type, data);

      expect(mockSendTemplatedEmail).toHaveBeenCalledWith(type, data.email, [
        { key: '{{customer_name}}', value: data.username },
        { key: '{{order_id}}', value: data.orderId },
        { key: '{{company_name}}', value: mockMailConfig.email.companyName },
        {
          key: '{{support_email}}',
          value: mockMailConfig.email.supportEmail,
        },
      ]);
    });

    it('should call sendTemplatedEmail with correct arguments for orderShipped with trackingId', async () => {
      const data = {
        email: 'user@example.com',
        username: 'Test User',
        orderId: 'ORD123',
        trackingId: 'TRK987',
      };
      const type = 'orderShipped' as EmailTemplateKey;

      await service.sendOrderStatusChangeMail(type, data);

      expect(mockSendTemplatedEmail).toHaveBeenCalledWith(type, data.email, [
        { key: '{{customer_name}}', value: data.username },
        { key: '{{order_id}}', value: data.orderId },
        { key: '{{company_name}}', value: mockMailConfig.email.companyName },
        {
          key: '{{support_email}}',
          value: mockMailConfig.email.supportEmail,
        },
        { key: '{{tracking_id}}', value: data.trackingId },
      ]);
    });

    it('should throw errors from sendTemplatedEmail', async () => {
      const data = {
        email: 'user@example.com',
        username: 'Test User',
        orderId: 'ORD123',
        trackingId: 'TRK987',
      };
      const type = 'orderShipped' as EmailTemplateKey;
      const error = new MailTemplateError('Template not found');
      mockSendTemplatedEmail.mockRejectedValueOnce(error);

      await expect(
        service.sendOrderStatusChangeMail(type, data),
      ).rejects.toThrow(error);
      expect(mockSendTemplatedEmail).toHaveBeenCalledTimes(1);
    });
  });
});
