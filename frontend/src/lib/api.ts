const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${path} — ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Gmail OAuth
// ---------------------------------------------------------------------------
export interface GmailStatus {
  connected: boolean;
  email: string | null;
  last_synced_at: string | null;
}

export const gmailApi = {
  getStatus: () => apiFetch<GmailStatus>("/api/auth/google/status"),
  getOAuthUrl: () => apiFetch<{ url: string }>("/api/auth/google/start"),
  disconnect: () => apiFetch<{ status: string }>("/api/auth/google/disconnect", { method: "POST" }),
};

// ---------------------------------------------------------------------------
// Email types returned by the backend
// ---------------------------------------------------------------------------
export type ApiEmailStatus = "unprocessed" | "processing" | "processed";
export type ApiAttachmentType = "excel" | "pdf" | "other";

export interface ApiAttachment {
  id: string;
  filename: string;
  type: ApiAttachmentType;
  size_bytes: number | null;
}

export interface ApiEmailDetail {
  id: string;
  sender: string;
  sender_email: string | null;
  subject: string;
  preview: string;
  received_at: string;
  status: ApiEmailStatus;
  attachments: ApiAttachment[];
  deal_id: string | null;
  body_html: string | null;
  body_text: string | null;
}

export interface ApiEmailListResponse {
  emails: ApiEmailDetail[];
  next_page_token: string | null;
}

export interface ProcessEmailResponse {
  deal_id: string | null;
  status: ApiEmailStatus;
}

export const emailsApi = {
  list: (pageToken?: string, query?: string) => {
    const params = new URLSearchParams();
    if (pageToken) params.set("page_token", pageToken);
    if (query) params.set("q", query);
    const qs = params.toString();
    return apiFetch<ApiEmailListResponse>(`/api/emails${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => apiFetch<ApiEmailDetail>(`/api/emails/${id}`),
  batchGet: (ids: string[]) =>
    apiFetch<ApiEmailDetail[]>("/api/emails/batch", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  process: (emailId: string) =>
    apiFetch<ProcessEmailResponse>(`/api/emails/${emailId}/process`, { method: "POST" }),
  attachmentUrl: (emailId: string, attachmentId: string, filename: string) =>
    `${API_BASE}/api/emails/${emailId}/attachments/${attachmentId}?filename=${encodeURIComponent(filename)}`,
};

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------
export interface ApiKeyMetric {
  label: string;
  value: string;
  flag: "ok" | "warn";
  per_unit?: string;
}

export interface ApiPipelineStage {
  stage: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  started_at: string | null;
  finished_at: string | null;
  detail: string | null;
}

export interface ApiDealDetail {
  id: string;
  property_name: string;
  address: string | null;
  county: string | null;
  msa: string | null;
  asset_class: string | null;
  recommendation: "proceed" | "negotiate" | "pass" | null;
  confidence: number | null;
  risk_rating: "low" | "moderate" | "moderate_high" | "high" | null;
  created_at: string;
  key_metrics: ApiKeyMetric[];
  highlights: { title: string; detail: string }[];
  risks: { title: string; detail: string; severity: string }[];
  pipeline: ApiPipelineStage[];
  screener_s3_key: string | null;
  screening_email_draft: string | null;
  property_info: Record<string, unknown>;
  financial_summary?: { label: string; value: string; dy?: string }[];
  sources_and_uses?: {
    sources: { item: string; total: string; per_unit: string; pct: string }[];
    uses:    { item: string; total: string; per_unit: string; pct: string }[];
  };
  sponsor_overview?:  string | null;
  location_summary?:  string | null;
}

export const dealsApi = {
  get: (dealId: string) => apiFetch<ApiDealDetail>(`/api/deals/${dealId}`),
  screenerUrl: (dealId: string) => `${API_BASE}/api/deals/${dealId}/screener`,
};

// ---------------------------------------------------------------------------
// Screened emails queue
// ---------------------------------------------------------------------------
export type ScreenedEmailStatus =
  | "queued"
  | "email_received"
  | "parsing_attachments"
  | "extracting_financials"
  | "running_screener"
  | "complete"
  | "failed";

export interface ScreenedEmail {
  id: string;
  user_id: string;
  gmail_message_id: string | null;
  subject: string;
  sender: string;
  sender_email: string | null;
  received_at: string | null;
  sent_for_screening_at: string;
  processing_status: ScreenedEmailStatus;
  pipeline: ApiPipelineStage[];
  deal_id: string | null;
  screened_title: string | null;
  screener_s3_key: string | null;
  created_at: string;
  updated_at: string;
}

export const screenedApi = {
  list: () => apiFetch<ScreenedEmail[]>("/api/screened"),
  screenerUrl: (dealId: string) => `${API_BASE}/api/deals/${dealId}/screener`,
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export interface ApiSettings {
  gmail: GmailStatus;
  filters: { keyword: string; enabled: boolean }[];
  screening: {
    model: string;
    interest_rate: number;
    points: number;
    interest_reserve_months: number;
    cap_rate: number;
  };
  notifications: {
    notify_on_complete: boolean;
    notify_on_proceed: boolean;
    daily_digest: boolean;
  };
}

export const settingsApi = {
  get: () => apiFetch<ApiSettings>("/api/settings"),
};
