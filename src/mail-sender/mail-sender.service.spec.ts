import { Test, TestingModule } from '@nestjs/testing';
import { MailSenderService } from './mail-sender.service';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn(),
  }),
}));

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'email.host') return 'mailhost';
    if (key === 'email.port') return 587;
    if (key === 'email.user') return 'from@email.com';
    if (key === 'email.password') return 'mail-password';
    return null;
  }),
};

describe('MailSenderService', () => {
  let service: MailSenderService;
  let createTransportMock: jest.MockedFunction<typeof createTransport>;

  beforeEach(async () => {
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
          MailSenderService,
        ],
      }).compile();
    } catch (error) {
      expect(error.message).toBe('Mail configuration missing.');
    }
  });

  describe('sendMail', () => {
    it('should send an email successfully', async () => {
      (service as any).transporter.sendMail.mockResolvedValueOnce({});

      await (service as any).sendMail(
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
        (service as any).sendMail(
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
        'order-uuid-1',
        'shipped',
      );

      expect((service as any).transporter.sendMail).toHaveBeenCalledTimes(1);
      expect((service as any).transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          subject: 'Your Books are on Their Way! Order #order-uuid-1',
        }),
      );
    });

    it('should send a delivered status email', async () => {
      (service as any).transporter.sendMail.mockResolvedValueOnce({});

      await service.sendOrderStatusUpdateMail(
        'client@example.com',
        'order-uuid-2',
        'delivered',
      );

      expect((service as any).transporter.sendMail).toHaveBeenCalledTimes(1);
      expect((service as any).transporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          subject: 'Your Book Order #order-uuid-2 Has Arrived!',
        }),
      );
    });

    it('should throw an error for invalid status', async () => {
      await expect(
        service.sendOrderStatusUpdateMail(
          'client@example.com',
          'order-uuid-3',
          'pending',
        ),
      ).rejects.toThrow('Invalid order status');
    });
  });
});
