export interface UserSubscription {
  id: number;
  user_id: number;
  revenuecat_user_id: string;
  product_id: string;
  entitlement_id: string;
  subscription_status: 'active' | 'expired' | 'cancelled' | 'billing_issue' | 'paused' | 'grace_period' | 'trial';
  period_type: 'subscription' | 'one_time';
  purchased_at: Date | null;
  expires_at: Date | null;
  cancelled_at: Date | null;
  is_active: boolean;
  platform: 'ios' | 'android' | 'web';
  store_transaction_id: string | null;
  original_transaction_id: string | null;
  raw_data: any | null;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionHistory {
  id: number;
  user_id: number;
  subscription_id: number | null;
  event_type: string;
  event_data: any;
  revenuecat_event_id: string | null;
  created_at: Date;
}

export interface CreateSubscriptionData {
  user_id: number;
  revenuecat_user_id: string;
  product_id: string;
  entitlement_id: string;
  subscription_status: UserSubscription['subscription_status'];
  period_type: UserSubscription['period_type'];
  purchased_at?: Date | null;
  expires_at?: Date | null;
  cancelled_at?: Date | null;
  is_active?: boolean;
  platform: UserSubscription['platform'];
  store_transaction_id?: string | null;
  original_transaction_id?: string | null;
  raw_data?: any;
}

export interface RevenueCatWebhookEvent {
  event: {
    id: string;
    type: string;
    app_user_id: string;
    product_id: string;
    period_type: 'subscription' | 'one_time';
    purchased_at_ms: number | null;
    expires_at_ms: number | null;
    environment: 'PRODUCTION' | 'SANDBOX';
    entitlement_ids: string[];
    transaction_id: string;
    original_transaction_id: string;
    store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL';
    [key: string]: any;
  };
  api_version: string;
}

