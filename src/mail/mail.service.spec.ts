import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template/mail-template.service';
import { NodemailerService } from './nodemailer/nodemailer.service';
import { MailTemplateError } from '../common/errors/mail-template.error';
import { ConfigService } from '@nestjs/config';

const mockTemplate = {
  subject: 'Welcome {{name}}',
  text: 'Hello {{name}}',
  html: '<p>Hello {{name}}</p>',
};

const mockFields = new Map([['{{name}}', 'Test User']]);

const mockMailTemplateService = {
  getTemplate: jest.fn(),
  fillMailTemplateContent: jest.fn((template: string, fields) => {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const placeholder = `{{${key}}}`;
      return fields.has(placeholder) ? fields.get(placeholder)! : match;
    });
  }),
};

const mockNodemailerService = {
  sendMail: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'email.companyName') return 'book store';
    if (key === 'email.supportEmail') return 'bookstore@support';
    return undefined;
  }),
};

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MailTemplateService,
          useValue: mockMailTemplateService,
        },
        {
          provide: NodemailerService,
          useValue: mockNodemailerService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    jest.clearAllMocks();
  });

  it('should send email with valid filled template', async () => {
    mockMailTemplateService.getTemplate.mockReturnValueOnce(mockTemplate);

    await service.sendTemplatedEmail(
      'orderComplete',
      'testuser@email.com',
      mockFields,
    );

    expect(mockMailTemplateService.getTemplate).toHaveBeenCalledWith(
      'orderComplete',
    );
    expect(
      mockMailTemplateService.fillMailTemplateContent,
    ).toHaveBeenCalledTimes(3);
    expect(mockNodemailerService.sendMail).toHaveBeenCalledWith(
      'testuser@email.com',
      'Welcome Test User',
      'Hello Test User',
      '<p>Hello Test User</p>',
    );
  });

  it('should throw if template is not found', async () => {
    mockMailTemplateService.getTemplate.mockReturnValueOnce(undefined);

    await expect(
      service.sendTemplatedEmail(
        'nonExistingTemplate' as any,
        'testuser@email.com',
        mockFields,
      ),
    ).rejects.toThrow(
      new MailTemplateError(`Template 'nonExistingTemplate' not found`),
    );
  });

  it('should throw if template is missing fields', async () => {
    mockMailTemplateService.getTemplate.mockReturnValueOnce({
      subject: '',
      text: '',
      html: null,
    });

    await expect(
      service.sendTemplatedEmail(
        'orderComplete',
        'testuser@email.com',
        mockFields,
      ),
    ).rejects.toThrow(
      new MailTemplateError(`Incomplete template content for 'orderComplete'`),
    );
  });

  it('should log warning for unfilled placeholders', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockMailTemplateService.getTemplate.mockReturnValueOnce(mockTemplate);

    mockMailTemplateService.fillMailTemplateContent = jest.fn(
      (template: string, fields: any) => template,
    );

    await service.sendTemplatedEmail(
      'orderComplete',
      'testuser@email.com',
      mockFields,
    );

    expect(console.warn).toHaveBeenCalledWith(
      `Template 'orderComplete' contains unfilled placeholders`,
    );
  });
});
