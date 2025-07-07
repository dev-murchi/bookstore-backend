import { Test, TestingModule } from '@nestjs/testing';
import { OrderMailProcessor } from './order-mail.processor';
import { MailService } from '../../../mail/mail.service';
import { Job } from 'bullmq';
import {
  OrderEmailTemplateKey,
  RefundEmailTemplateKey,
} from 'src/common/types/email-config.type';

const mockSendTemplatedEmail = jest.fn();

const mockMailService = {
  sendTemplatedEmail: mockSendTemplatedEmail,
};

describe('OrderMailProcessor', () => {
  let processor: OrderMailProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderMailProcessor,
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    processor = module.get<OrderMailProcessor>(OrderMailProcessor);
    jest.clearAllMocks();
  });

  const baseData = {
    email: 'testuser@email.com',
    username: 'Test User',
    orderId: 'order-uuid-1',
  };

  it('should generate fields for orderComplete', async () => {
    const job: Job<any, any, OrderEmailTemplateKey> = {
      id: 'job-123',
      name: 'orderComplete',
      data: {
        ...baseData,
      },
    } as any;

    const result = await processor.generateTemplateFields(job);
    expect(result.fields).toEqual([
      { key: '{{order_id}}', value: 'order-uuid-1' },
      { key: '{{customer_name}}', value: 'Test User' },
    ]);
  });

  it('should include trackingId for orderShipped', async () => {
    const job: Job<any, any, OrderEmailTemplateKey> = {
      id: 'job-456',
      name: 'orderShipped',
      data: {
        ...baseData,
        trackingId: 'TRK456',
      },
    } as any;

    const result = await processor.generateTemplateFields(job);
    expect(result.fields).toContainEqual({
      key: '{{tracking_id}}',
      value: 'TRK456',
    });
  });

  it('should throw if trackingId is missing for orderShipped', async () => {
    const job: Job<any, any, OrderEmailTemplateKey> = {
      id: 'job-789',
      name: 'orderShipped',
      data: {
        ...baseData,
      },
    } as any;

    await expect(processor.generateTemplateFields(job)).rejects.toThrow(
      "Job job-789: Missing 'trackingId' in job data for job type 'orderShipped'. Job type 'orderShipped' requires 'trackingId'",
    );
  });

  it('should include refundId for refundCreated', async () => {
    const job: Job<any, any, RefundEmailTemplateKey> = {
      id: 'job-321',
      name: 'refundCreated',
      data: {
        ...baseData,
        refundId: 're_123',
      },
    } as any;

    const result = await processor.generateTemplateFields(job);
    expect(result.fields).toContainEqual({
      key: '{{refund_id}}',
      value: 're_123',
    });
  });

  it('should throw if refundId missing for refundFailed', async () => {
    const job: Job<any, any, RefundEmailTemplateKey> = {
      id: 'job-654',
      name: 'refundFailed',
      data: {
        ...baseData,
      },
    } as any;

    await expect(processor.generateTemplateFields(job)).rejects.toThrow(
      "Job job-654: Missing 'refundId' in job data for job type 'refundFailed'. Refund mail type 'refundFailed' requires 'refundId'",
    );
  });

  it('should throw if email is missing', async () => {
    const job: Job<any, any, OrderEmailTemplateKey> = {
      id: 'job-999',
      name: 'orderPending',
      data: {
        ...baseData,
        email: '',
      },
    } as any;

    await expect(processor.generateTemplateFields(job)).rejects.toThrow(
      "Job job-999: Missing 'email' in job data for job type 'orderPending'.",
    );
  });

  it('should throw if username is missing', async () => {
    const job: Job<any, any, OrderEmailTemplateKey> = {
      id: 'job-998',
      name: 'orderPending',
      data: {
        ...baseData,
        username: undefined,
      },
    } as any;

    await expect(processor.generateTemplateFields(job)).rejects.toThrow(
      "Job job-998: Missing 'username' in job data for job type 'orderPending'.",
    );
  });

  it('should throw if orderId is missing', async () => {
    const job: Job<any, any, OrderEmailTemplateKey> = {
      id: 'job-997',
      name: 'orderPending',
      data: {
        ...baseData,
        orderId: null,
      },
    } as any;

    await expect(processor.generateTemplateFields(job)).rejects.toThrow(
      "Job job-997: Missing 'orderId' in job data for job type 'orderPending'.",
    );
  });
});
