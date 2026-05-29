export type ClaimSource = 'Amazon' | 'Flipkart' | 'Email' | 'Shopify';
export type ClaimType = 'Missing' | 'Damaged' | 'CustomerReturn' | 'CustomerServiceIssue' | 'RejectedDelivery';
export type ClaimStatus = 'New' | 'Awaiting Triage' | 'In Review' | 'Escalated' | 'Resolved' | 'Inspected';

export interface Claim {
  claimId?: string;
  lpn: string;
  source: ClaimSource;
  channel: string; // Company B2B/B2C
  type: ClaimType;
  sku: string;
  fnsku?: string;
  shippedQuantity?: number;
  deliveryStatus?: string;
  condition?: string;
  reason?: string;
  driveLink?: string;
  orderDriveLink?: string;
  trackingId?: string;
  orderId: string;
  amazonOrderId?: string;
  productName?: string;
  status: ClaimStatus;
  slaDaysElapsed: number;
  qty?: number;
  amount?: number;
  currency?: string;
  reimbursementId?: string;
  approvalDate?: string;
}
