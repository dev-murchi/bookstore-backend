export interface CreateRefundData {
  refundId: string;
  orderId: string;
  amount: number;
}

export interface UpdateRefundData {
  refundId: string;
  status: string;
  failureReason?: string;
}

export interface RefundData {
  refundId: string;
  orderId: string;
  status: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
  failureReason: string | null;
}
