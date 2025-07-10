import { Test, TestingModule } from '@nestjs/testing';
import { MailTemplateService } from './mail-template.service';

import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { MailTemplateError } from '../../common/errors/mail-template.error';
import { MailConfigError } from '../../common/errors/mail-config.error';

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockImplementation((filePath) => {
    if (filePath.includes('password-reset.text')) {
      return mockPasswordResetTemplate.text;
    }
    if (filePath.includes('password-reset.html')) {
      return mockPasswordResetTemplate.html;
    }
    if (filePath.includes('order-complete.text')) {
      return mockOrderCompleteTemplate.text;
    }
    if (filePath.includes('order-complete.html')) {
      return mockOrderCompleteTemplate.html;
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
    if (fullPath.includes('order-complete.text')) {
      return 'path/to/text/order-complete.text';
    }
    if (fullPath.includes('order-complete.html')) {
      return 'path/to/html/order-complete.html';
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

const mockPasswordResetTemplate = {
  text: 'Hello {{customer_name}},\n\nReset your password here: {{link}}\n\nRegards,\n{{company_name}} Support\n{{support_email}}',
  html: '<p>Hello {{customer_name}},</p><p>Reset your password here: <a href="{{link}}">Reset Link</a></p><p>Regards,<br>{{company_name}} Support<br>{{support_email}}</p>',
};

const mockOrderCompleteTemplate = {
  subject: 'Order Placed! - {{company_name}}',
  text: 'Hello {{customer_name}},\n\nYour order {{order_id}} has been placed.\n\nRegards,\n{{company_name}} Support\n{{support_email}}',
  html: '<p>Hello {{customer_name}},</p><p>Your order {{order_id}} has been placed.</p><p>Regards,<br>{{company_name}} Support<br>{{support_email}}</p>',
};

const mockOrderShippedTemplate = {
  subject: 'Your Order Has Shipped! - {{company_name}}',
  text: 'Hello {{customer_name}},\n\nYour order {{order_id}} has been shipped. Tracking ID: {{tracking_id}}\n\nRegards,\n{{company_name}} Support\n{{support_email}}',
  html: '<p>Hello {{customer_name}},</p><p>Your order {{order_id}} has been shipped. Tracking ID: {{tracking_id}}</p><p>Regards,<br>{{company_name}} Support<br>{{support_email}}</p>',
};

const mockTemplates = {
  authPasswordReset: {
    subject: 'Reset Your Password - {{company_name}}',
    fileName: 'password-reset',
  },
  orderComplete: {
    subject: 'Order Placed! - {{company_name}}',
    fileName: 'order-complete',
  },
  orderShipped: {
    subject: 'Your Order Has Shipped! - {{company_name}}',
    fileName: 'order-shipped',
  },
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'email.templates') return mockTemplates;
    return undefined; // For missing config
  }),
};

describe('MailTemplateService', () => {
  let service: MailTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailTemplateService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MailTemplateService>(MailTemplateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Constructor and Initialization', () => {
    it('should throw MailConfigError if a required config is missing during getConfig', async () => {
      const testModule = Test.createTestingModule({
        providers: [
          MailTemplateService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => undefined),
            },
          },
        ],
      });
      try {
        await testModule.compile();
      } catch (error) {
        expect(error).toBeInstanceOf(MailConfigError);
        expect(error.message).toBe('Missing config value: email.templates');
        expect(fs.readFileSync).toHaveBeenCalledTimes(6);
      }
    });

    it('should throw MailTemplateError if template reading fails during initializeTemplates', async () => {
      jest.clearAllMocks();
      jest.restoreAllMocks();

      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('File read error');
      });

      const testModule = Test.createTestingModule({
        providers: [
          MailTemplateService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'email.templates') return mockTemplates;
                return undefined;
              }),
            },
          },
        ],
      });

      try {
        await testModule.compile();
      } catch (error) {
        expect(error).toBeInstanceOf(MailTemplateError);
        expect(error.message).toBe('Failed to load email templates');
        expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      }
    });

    it('should initialize the  templates successfully', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('email.templates');
      expect(service['templates'].size).toBe(3);
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
      const fileName = 'non-existent-file.txt';

      try {
        service['readTemplateFile'](fileName);
      } catch (error) {
        expect(error).toBeInstanceOf(MailTemplateError);
        expect(error.message).toBe(`Failed to read template: ${fileName}`);
      }
    });

    it('should read a template file successfully', () => {
      const filePath = 'path/to/some/file.txt';
      const fileContent = 'Some content';
      (path.join as jest.Mock).mockReturnValueOnce(filePath);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(fileContent);

      const fileName = 'some-file.txt';
      const result = service['readTemplateFile'](fileName);
      expect(path.join).toHaveBeenCalledWith(
        expect.any(String),
        '../../assets/mail-templates',
        fileName,
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(filePath, 'utf-8');
      expect(result).toBe(fileContent);
    });
  });

  describe('loadTemplate', () => {
    it('should throw MailTemplateError from readTemplateFile', () => {
      (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Failed to read text template');
      });

      const fileName = 'file';
      try {
        service['loadTemplate']('Sub', fileName);
      } catch (error) {
        expect(error).toBeInstanceOf(MailTemplateError);
        expect(error.message).toBe(
          `Failed to read template: text/${fileName}.text`,
        );
      }
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

  describe('fillTemplate', () => {
    it('should replace all placeholders correctly', () => {
      const template = 'Hello {{name}}, your order {{id}} is {{status}}.';
      const fields = new Map([
        ['{{name}}', 'John Doe'],
        ['{{id}}', '12345'],
        ['{{status}}', 'shipped'],
      ]);
      const result = service.fillMailTemplateContent(template, fields);
      expect(result).toBe('Hello John Doe, your order 12345 is shipped.');
    });

    it('should handle templates with no placeholders', () => {
      const template = 'Static content.';
      const fields = new Map([['{{name}}', 'John']]);
      const result = service.fillMailTemplateContent(template, fields);
      expect(result).toBe('Static content.');
    });

    it('should handle fields not present in the template', () => {
      const template = 'Hello {{name}}.';
      const fields = new Map([
        ['{{name}}', 'John'],
        ['{{age}}', '30'],
      ]);
      const result = service.fillMailTemplateContent(template, fields);
      expect(result).toBe('Hello John.');
    });
  });

  describe('getTemplate', () => {
    it('should return the correct template content for a valid key', () => {
      const templateKey = 'authPasswordReset';
      const expectedTemplate = {
        subject: mockTemplates.authPasswordReset.subject,
        text: mockPasswordResetTemplate.text,
        html: mockPasswordResetTemplate.html,
      };
      const result = service.getTemplate(templateKey);
      expect(result).toEqual(expectedTemplate);
    });

    it('should return null for an invalid template key', () => {
      const templateKey = 'nonExistentTemplate' as any; // Cast to any for testing invalid key
      const result = service.getTemplate(templateKey);
      expect(result).toBeNull();
    });

    it('should return the correct template content for another valid key (orderComplete)', () => {
      const templateKey = 'orderComplete';
      const expectedTemplate = {
        subject: mockTemplates.orderComplete.subject,
        text: mockOrderCompleteTemplate.text,
        html: mockOrderCompleteTemplate.html,
      };
      const result = service.getTemplate(templateKey);
      expect(result).toEqual(expectedTemplate);
    });
  });
});
