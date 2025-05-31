import { Test, TestingModule } from '@nestjs/testing';
import { MailSenderService } from './mail-sender.service';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn(),
  }),
}));

// Mock fs and path for template reading in the constructor
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockImplementation((filePath) => {
    // Simulate reading different template files
    if (filePath.includes('password-reset.html')) {
      return '<p>Hello, reset your password here: {{link}}</p>';
    }
    if (filePath.includes('password-reset.text')) {
      return 'Hello, reset your password here: {{link}}';
    }
    if (filePath.includes('refund-create.html')) {
      return '<p>Refund created for {{customer_name}} for order {{order_id}} of {{amount}}.</p>';
    }
    if (filePath.includes('refund-create.text')) {
      return 'Refund created for {{customer_name}} for order {{order_id}} of {{amount}}.';
    }
    if (filePath.includes('refund-complete.html')) {
      return '<p>Refund completed for {{customer_name}} for order {{order_id}} of {{amount}}.</p>';
    }
    if (filePath.includes('refund-complete.text')) {
      return 'Refund completed for {{customer_name}} for order {{order_id}} of {{amount}}.';
    }
    if (filePath.includes('refund-failed.html')) {
      return '<p>Refund failed for {{customer_name}} for order {{order_id}} of {{amount}} due to: {{failure_reason}}</p>';
    }
    if (filePath.includes('refund-failed.text')) {
      return 'Refund failed for {{customer_name}} for order {{order_id}} of {{amount}} due to: {{failure_reason}}.';
    }
    throw new Error(`File not found: ${filePath}`);
  }),
}));

jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/')),
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
  let sendMailSpy: jest.SpyInstance;

  beforeEach(async () => {
    (fs.readFileSync as jest.Mock).mockClear();
    (path.join as jest.Mock).mockClear();
    mockConfigService.get.mockClear();

    (path.join as jest.Mock).mockImplementation((...args: string[]) =>
      args.join('/'),
    );

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
    sendMailSpy = jest.spyOn((service as any).transporter, 'sendMail');
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

  it('should throw an error if any mail configuration is missing', async () => {
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

  it('should throw an error if email templates cannot be loaded', async () => {
    (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('File read error');
    });

    await expect(
      Test.createTestingModule({
        providers: [
          MailSenderService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile(),
    ).rejects.toThrow(
      'Failed to initialize email service: Could not load templates.',
    );
  });

  describe('sendMail', () => {
    it('should send an email successfully', async () => {
      sendMailSpy.mockResolvedValueOnce({ messageId: 'test-message-id' });

      const info = await (service as any).sendMail(
        'client@example.com',
        'Subject',
        'Text',
        '<p>HTML</p>',
      );

      expect(sendMailSpy).toHaveBeenCalledWith({
        from: 'from@email.com',
        to: 'client@example.com',
        subject: 'Subject',
        text: 'Text',
        html: '<p>HTML</p>',
      });
      expect(info).toEqual({ messageId: 'test-message-id' });
    });

    it('should throw an error if sending email fails', async () => {
      sendMailSpy.mockRejectedValueOnce(new Error('SMTP connection failed'));

      await expect(
        (service as any).sendMail(
          'client@example.com',
          'Subject',
          'Text',
          '<p>HTML</p>',
        ),
      ).rejects.toThrow('Failed to send the email');
      expect(sendMailSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendResetPasswordMail', () => {
    it('should send a reset password email', async () => {
      sendMailSpy.mockResolvedValueOnce({});

      await service.sendResetPasswordMail(
        'client@example.com',
        'user',
        'http://reset.link',
      );

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          subject: 'Reset your password',
          html: '<p>Hello, reset your password here: http://reset.link</p>',
          text: 'Hello, reset your password here: http://reset.link',
        }),
      );
    });

    it('should throw an error if sendResetPasswordMail fails due to an internal email sending error', async () => {
      sendMailSpy.mockRejectedValueOnce(new Error('SMTP connection failed'));

      await expect(
        service.sendResetPasswordMail(
          'client@example.com',
          'user',
          'http://reset.link',
        ),
      ).rejects.toThrow('Failed to send password reset email.');
      expect(sendMailSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendOrderStatusUpdateMail', () => {
    it('should send a shipped status email', async () => {
      sendMailSpy.mockResolvedValueOnce({});
      await service.sendOrderStatusUpdateMail(
        'client@example.com',
        'order-uuid-1',
        'shipped',
      );

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          subject: 'Your Books are on Their Way! Order #order-uuid-1',
          text: 'book are shipped',
          html: '<p>books are shipped</p>',
        }),
      );
    });

    it('should send a delivered status email', async () => {
      sendMailSpy.mockResolvedValueOnce({});

      await service.sendOrderStatusUpdateMail(
        'client@example.com',
        'order-uuid-2',
        'delivered',
      );

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@example.com',
          subject: 'Your Book Order #order-uuid-2 Has Arrived!',
          text: 'book are delivered',
          html: '<p>books are delivered</p>',
        }),
      );
    });

    it('should throw an error for invalid status', async () => {
      await expect(
        service.sendOrderStatusUpdateMail(
          'client@example.com',
          'order-uuid-3',
          'pending', // Invalid status
        ),
      ).rejects.toThrow(
        'Failed to send order status update email for Order order-uuid-3.',
      );
      expect(sendMailSpy).not.toHaveBeenCalled();
    });

    it('should throw an error if order status update mail fails to send (shipped)', async () => {
      sendMailSpy.mockRejectedValueOnce(new Error('Connection lost'));
      await expect(
        service.sendOrderStatusUpdateMail(
          'client@example.com',
          'order-uuid-1',
          'shipped',
        ),
      ).rejects.toThrow(
        'Failed to send order status update email for Order order-uuid-1.',
      );
      expect(sendMailSpy).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if order status update mail fails to send (delivered)', async () => {
      sendMailSpy.mockRejectedValueOnce(new Error('Connection lost'));
      await expect(
        service.sendOrderStatusUpdateMail(
          'client@example.com',
          'order-uuid-2',
          'delivered',
        ),
      ).rejects.toThrow(
        'Failed to send order status update email for Order order-uuid-2.',
      );
      expect(sendMailSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendRefundCreatedMail', () => {
    const refundData = {
      orderId: 'order-refund-1',
      amount: '50.00',
      email: 'customer@example.com',
      customerName: 'Test Customer',
    };

    it('should send a refund created email successfully', async () => {
      sendMailSpy.mockResolvedValueOnce({});
      await service.sendRefundCreatedMail(refundData);

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: refundData.email,
          subject: 'We’ve initiated your refund',
          html: '<p>Refund created for Test Customer for order order-refund-1 of 50.00.</p>',
          text: 'Refund created for Test Customer for order order-refund-1 of 50.00.',
        }),
      );
    });

    it('should throw an error if sending refund created email fails', async () => {
      sendMailSpy.mockRejectedValueOnce(new Error('Mail server down'));
      await expect(service.sendRefundCreatedMail(refundData)).rejects.toThrow(
        `Failed to send refund created email for Order ${refundData.orderId}.`,
      );
      expect(sendMailSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendRefundCompletedMail', () => {
    const refundData = {
      orderId: 'order-refund-2',
      amount: '75.50',
      email: 'customer2@example.com',
      customerName: 'Another Customer',
    };

    it('should send a refund completed email successfully', async () => {
      sendMailSpy.mockResolvedValueOnce({});
      await service.sendRefundCompletedMail(refundData);

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: refundData.email,
          subject: 'Your refund has been completed',
          html: '<p>Refund completed for Another Customer for order order-refund-2 of 75.50.</p>',
          text: 'Refund completed for Another Customer for order order-refund-2 of 75.50.',
        }),
      );
    });

    it('should throw an error if sending refund completed email fails', async () => {
      sendMailSpy.mockRejectedValueOnce(new Error('Network error'));
      await expect(service.sendRefundCompletedMail(refundData)).rejects.toThrow(
        `Failed to send refund completed email for Order ${refundData.orderId}.`,
      );
      expect(sendMailSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendRefundFailedMail', () => {
    const refundData = {
      orderId: 'order-refund-3',
      amount: '25.00',
      email: 'customer3@example.com',
      customerName: 'Third Customer',
      failureReason: 'Insufficient funds at origin',
    };

    it('should send a refund failed email successfully', async () => {
      sendMailSpy.mockResolvedValueOnce({});
      await service.sendRefundFailedMail(refundData);

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      expect(sendMailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: refundData.email,
          subject: 'There was a problem with your refund',
          html: '<p>Refund failed for Third Customer for order order-refund-3 of 25.00 due to: Insufficient funds at origin</p>',
          text: 'Refund failed for Third Customer for order order-refund-3 of 25.00 due to: Insufficient funds at origin.',
        }),
      );
    });

    it('should throw an error if sending refund failed email fails', async () => {
      sendMailSpy.mockRejectedValueOnce(new Error('Server refused connection'));
      await expect(service.sendRefundFailedMail(refundData)).rejects.toThrow(
        `Failed to send refund failed email for Order ${refundData.orderId}.`,
      );
      expect(sendMailSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateFieldsAndSendMail', () => {
    it('should throw an error if email template content is missing', async () => {
      (fs.readFileSync as jest.Mock).mockClear().mockReturnValue(''); // Empty HTML && Text

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailSenderService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();
      const tempService = module.get<MailSenderService>(MailSenderService);

      await expect(
        tempService.sendResetPasswordMail('test@example.com', 'user', 'link'),
      ).rejects.toThrow('Failed to send password reset email.');

      expect(sendMailSpy).not.toHaveBeenCalled();
    });
  });
});
