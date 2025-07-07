export interface BaseMailJob {
  email: string;
  username: string;
}

export interface OrderMailJob extends BaseMailJob {
  orderId: string;
  refundId?: string;
  trackingId?: string;
}

export interface AuthMailJob extends BaseMailJob {
  passwordResetLink: string;
}
