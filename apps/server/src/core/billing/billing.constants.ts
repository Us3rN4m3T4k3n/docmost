export enum BillingGateway {
  STRIPE = 'stripe',
  KIWIFY = 'kiwify',
}

export enum StripeEventType {
  CHECKOUT_COMPLETED = 'checkout.session.completed',
  SUBSCRIPTION_DELETED = 'customer.subscription.deleted',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
  INVOICE_PAYMENT_SUCCEEDED = 'invoice.payment_succeeded',
}

export enum KiwifyEventType {
  PURCHASE_APPROVED = 'compra_aprovada',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  SUBSCRIPTION_LATE = 'subscription_late',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',
}
