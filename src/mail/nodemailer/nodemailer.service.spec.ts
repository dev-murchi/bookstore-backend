import { Test, TestingModule } from '@nestjs/testing';
import { NodemailerService } from './nodemailer.service';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { MailConfigError } from 'src/common/errors/mail-config.error';
import { MailSendError } from 'src/common/errors/mail-send.error';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
  })),
}));

const mockMailConfig = {
  host: 'smtp.test.com',
  port: 587,
  user: 'test@email.com',
  password: 'password',
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'email.host') return mockMailConfig.host;
    if (key === 'email.port') return mockMailConfig.port;
    if (key === 'email.user') return mockMailConfig.user;
    if (key === 'email.password') return mockMailConfig.password;
    return undefined;
  }),
};
const mockTransporter = {
  sendMail: jest.fn(),
};

describe('NodemailerService', () => {
  let service: NodemailerService;
  let configService: ConfigService;

  const mockEmailConfig = {
    host: 'smtp.test.com',
    port: 587,
    user: 'test@email.com',
    password: 'password123',
  };

  beforeEach(async () => {
    (createTransport as jest.Mock).mockClear();
    (createTransport as jest.Mock).mockReturnValueOnce(mockTransporter);
    mockTransporter.sendMail.mockClear();

    mockConfigService.get.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodemailerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<NodemailerService>(NodemailerService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Constructor and Initialization', () => {
    it('should throw MailConfigError if a required config is missing during getConfig', async () => {
      const testModule = Test.createTestingModule({
        providers: [
          NodemailerService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'email.host') return undefined;
                if (key === 'email.port') return mockMailConfig.port;
                if (key === 'email.user') return mockMailConfig.user;
                if (key === 'email.password') return mockMailConfig.password;
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

    it('should initialize the transporter successfully', () => {
      expect(configService.get).toHaveBeenCalledWith('email.host');
      expect(configService.get).toHaveBeenCalledWith('email.port');
      expect(configService.get).toHaveBeenCalledWith('email.user');
      expect(configService.get).toHaveBeenCalledWith('email.password');
      expect(createTransport).toHaveBeenCalledWith({
        host: mockMailConfig.host,
        port: mockMailConfig.port,
        secure: true,
        auth: {
          user: mockMailConfig.user,
          pass: mockMailConfig.password,
        },
      });
    });
  });

  describe('getConfig', () => {
    it('should return the config value if found', () => {
      const value = service['getConfig']('email.host');
      expect(value).toBe(mockEmailConfig.host);
      expect(configService.get).toHaveBeenCalledWith('email.host');
    });

    it('should throw MailConfigError if config value is missing', () => {
      mockConfigService.get.mockReturnValueOnce(undefined);

      try {
        service['getConfig']('email.user');
      } catch (error) {
        expect(error).toBeInstanceOf(MailConfigError);
        expect(error.message).toBe('Missing config value: email.user');
      }
    });
  });

  describe('sendMail', () => {
    const email = 'testuser@email.com';
    const subject = 'Test Subject';
    const text = 'This is the test text.';
    const html = '<p>This is the test HTML.</p>';

    it('should send an email successfully', async () => {
      const mockInfo = { messageId: '12345' };
      (mockTransporter.sendMail as jest.Mock).mockResolvedValueOnce(mockInfo);

      const result = await service.sendMail(email, subject, text, html);

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: mockEmailConfig.user,
        to: email,
        subject,
        text,
        html,
      });
      expect(result).toEqual(mockInfo);
    });

    it('should throw MailSendError if email sending fails', async () => {
      const mockError = new Error('SMTP connection failed');
      (mockTransporter.sendMail as jest.Mock).mockRejectedValueOnce(mockError);

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        await service.sendMail(email, subject, text, html);
      } catch (error) {
        expect(error).toBeInstanceOf(MailSendError);
        expect(error.message).toBe('Failed to send the email');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to send the email. Error:',
          mockError,
        );
      }

      consoleErrorSpy.mockRestore();
    });
  });
});
