import { PaymentStatus } from '../enum/payment-status.enum';

export interface PaymentData {
  orderId: string;
  transactionId: string | null;
  status: PaymentStatus;
  amount: number;
}
