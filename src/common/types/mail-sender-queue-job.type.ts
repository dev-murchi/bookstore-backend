export interface OrderStatusUpdateJob {
  email: string;
  username: string;
  orderId: string;
  trackingId?: string;
}

export interface RefundStatusUpdateJob {
  email: string;
  username: string;
  orderId: string;
}

export interface PasswordResetJob {
  email: string;
  username: string;
  link: string;
}

export type MailSenderQueueJob =
  | OrderStatusUpdateJob
  | PasswordResetJob
  | RefundStatusUpdateJob;
