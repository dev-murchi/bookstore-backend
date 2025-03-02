import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
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

const mockSendMail = jest.fn();
const mockTransporter = {
  sendMail: mockSendMail,
};

describe('MailService', () => {
  let service: MailService;

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
    (createTransport as jest.Mock).mockReturnValue(mockTransporter);
    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send reset password mail', async () => {
    const email = 'testuser@email.com';
    const username = 'Test User';
    const resetLink = 'http://localhost/reset-password?token=reset-token`';

    mockSendMail.mockResolvedValueOnce({
      messageId: 'messageid',
    });

    const result = await service.sendResetPasswordMail(
      email,
      username,
      resetLink,
    );

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: email,
        subject: 'Reset your password',
      }),
    );
    expect(result).toEqual({
      messageId: 'messageid',
    });
  });

  it('should handle errors gracefully', async () => {
    const email = 'testuser@email.com';
    const username = 'Test User';
    const resetLink = 'http://localhost/reset-password?token=reset-token`';
    mockSendMail.mockRejectedValue(new Error('SMTP error'));
    await expect(
      service.sendResetPasswordMail(email, username, resetLink),
    ).rejects.toThrow('Failed to send password reset email');
  });
});
