import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn(),
  }),
}));

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'MAIL_HOST') return 'mailhost';
    if (key === 'MAIL_PORT') return 587;
    if (key === 'MAIL_ADDRESS') return 'from@email.com';
    if (key === 'MAIL_PASS') return 'mail-password';
    return null;
  }),
};

describe('MailService', () => {
  let service: MailService;
  let createTransportMock: jest.MockedFunction<typeof createTransport>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();
    service = module.get<MailService>(MailService);
    createTransportMock = createTransport as jest.MockedFunction<
      typeof createTransport
    >;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create transporter with correct configuration', () => {
    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'mailhost',
      port: 587,
      secure: true,
      auth: {
        user: 'from@email.com',
        pass: 'mail-password',
      },
    });
  });

  it('should throw an error if any config is missing', async () => {
    try {
      await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(null),
            },
          },
          MailService,
        ],
      }).compile();
    } catch (error) {
      expect(error.message).toBe('Mail configuration missing.');
    }
  });

  describe('sendMail', () => {
    it('should send an email successfully', async () => {
      (service as any).transporter.sendMail.mockResolvedValueOnce({});

      await service.sendMail(
        'client@example.com',
        'Subject',
        'Text',
        '<p>HTML</p>',
      );

      expect((service as any).transporter.sendMail).toHaveBeenCalledWith({
        from: 'from@email.com',
        to: 'client@example.com',
        subject: 'Subject',
        text: 'Text',
        html: '<p>HTML</p>',
      });
    });

    it('should throw an error if sending email fails', async () => {
      (service as any).transporter.sendMail.mockRejectedValueOnce(
        new Error('Failed'),
      );

      await expect(
        service.sendMail(
          'client@example.com',
          'Subject',
          'Text',
          '<p>HTML</p>',
        ),
      ).rejects.toThrow('Failed to send the email');
    });
  });

  describe('sendResetPasswordMail', () => {
    it('should send a reset password email', async () => {
      (service as any).transporter.sendMail.mockResolvedValueOnce({});

      await service.sendResetPasswordMail(
        'client@example.com',
        'user',
        'http://reset.link',
      );

      expect((service as any).transporter.sendMail).toHaveBeenCalledTimes(1);
      expect((service as any).transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          subject: 'Reset your password',
        }),
      );
    });
  });

  describe('sendOrderStatusUpdateMail', () => {
    it('should send a shipped status email', async () => {
      (service as any).transporter.sendMail.mockResolvedValueOnce({});
      await service.sendOrderStatusUpdateMail(
        'client@example.com',
        1,
        'shipped',
      );

      expect((service as any).transporter.sendMail).toHaveBeenCalledTimes(1);
      expect((service as any).transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          subject: 'Your Books are on Their Way! Order #1',
        }),
      );
    });

    it('should send a delivered status email', async () => {
      (service as any).transporter.sendMail.mockResolvedValueOnce({});

      await service.sendOrderStatusUpdateMail(
        'client@example.com',
        2,
        'delivered',
      );

      expect((service as any).transporter.sendMail).toHaveBeenCalledTimes(1);
      expect((service as any).transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          subject: 'Your Book Order #2 Has Arrived!',
        }),
      );
    });

    it('should throw an error for invalid status', async () => {
      await expect(
        service.sendOrderStatusUpdateMail('client@example.com', 3, 'pending'),
      ).rejects.toThrow('Invalid order status');
    });
  });
});
