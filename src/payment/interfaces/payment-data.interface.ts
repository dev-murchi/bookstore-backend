import { PaymentStatus } from '../enum/payment-status.enum';

export interface PaymentData {
  orderId: number;
  transactionId: string | null;
  status: PaymentStatus;
  amount: number;
}
