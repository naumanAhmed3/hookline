export type DeliveryStatus =
  | 'pending'
  | 'delivering'
  | 'succeeded'
  | 'failed'
  | 'dead';

export interface Endpoint {
  id: string;
  name: string;
  url: string;
  secret: string;
  enabled: boolean;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  idempotency_key: string | null;
  source: string | null;
  created_at: string;
}

export interface Delivery {
  id: string;
  event_id: string;
  endpoint_id: string;
  status: DeliveryStatus;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  claimed_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryAttempt {
  id: string;
  delivery_id: string;
  attempt_number: number;
  ok: boolean;
  status_code: number | null;
  error: string | null;
  response_snippet: string | null;
  duration_ms: number;
  attempted_at: string;
}

/** A delivery joined with its event + endpoint, for the dashboard. */
export interface DeliveryRow extends Delivery {
  event_type: string;
  endpoint_name: string;
  endpoint_url: string;
}
