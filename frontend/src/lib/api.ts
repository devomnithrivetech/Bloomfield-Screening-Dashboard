import { supabase } from "./supabase";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
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

export interface ApiDashboardStats {
  total_screened: number;
  screened_this_week: number;
  in_progress: number;
  inbox_this_week: number;
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
  /**
   * Send a Gmail email through the AI screening pipeline.
   *
   * Uses multipart/form-data so that `extraFiles` (user-uploaded documents) can
   * be included alongside the metadata fields.  `additionalInstructions` is
   * injected verbatim into the analyst prompt.
   */
  process: async (
    emailId: string,
    meta?: { subject?: string; sender?: string; sender_email?: string; received_at?: string },
    extraFiles?: File[],
    additionalInstructions?: string,
  ): Promise<ProcessEmailResponse> => {
    const { data: { session } } = await supabase.auth.getSession();
    const form = new FormData();
    if (meta?.subject)      form.append("subject",      meta.subject);
    if (meta?.sender)       form.append("sender",       meta.sender);
    if (meta?.sender_email) form.append("sender_email", meta.sender_email);
    if (meta?.received_at)  form.append("received_at",  meta.received_at);
    if (additionalInstructions?.trim()) {
      form.append("additional_instructions", additionalInstructions.trim());
    }
    (extraFiles ?? []).forEach((f) => form.append("extra_files", f));

    const headers: Record<string, string> = {};
    if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

    const res = await fetch(`${API_BASE}/api/emails/${emailId}/process`, {
      method: "POST",
      headers,
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: /api/emails/${emailId}/process — ${text}`);
    }
    return res.json() as Promise<ProcessEmailResponse>;
  },
  attachmentUrl: (emailId: string, attachmentId: string, filename: string) =>
    `${API_BASE}/api/emails/${emailId}/attachments/${attachmentId}?filename=${encodeURIComponent(filename)}`,
  stats: () => apiFetch<ApiDashboardStats>("/api/emails/stats"),
  summarize: (emailId: string) =>
    apiFetch<{ summary: string }>(`/api/emails/${emailId}/summarize`, { method: "POST" }),
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
  getScreenerDownloadUrl: (dealId: string) =>
    apiFetch<{ url: string }>(`/api/deals/${dealId}/screener`),
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
};

// ---------------------------------------------------------------------------
// Manual uploads
// ---------------------------------------------------------------------------
export interface UploadDealResponse {
  screened_email_id: string;
  email_id: string;
  status: string;
}

export interface UploadDealMeta {
  subject?: string;
  sender?: string;
  sender_email?: string;
  body_text?: string;
}

export const uploadsApi = {
  /**
   * Upload deal documents directly from the user's device.
   * Uses multipart/form-data — bypasses apiFetch which forces application/json.
   */
  upload: async (files: File[], meta: UploadDealMeta): Promise<UploadDealResponse> => {
    const { data: { session } } = await supabase.auth.getSession();
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    if (meta.subject)      form.append("subject",      meta.subject);
    if (meta.sender)       form.append("sender",       meta.sender);
    if (meta.sender_email) form.append("sender_email", meta.sender_email);
    if (meta.body_text)    form.append("body_text",    meta.body_text);

    const headers: Record<string, string> = {};
    if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: "POST",
      headers,
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: /api/uploads — ${text}`);
    }
    return res.json() as Promise<UploadDealResponse>;
  },
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
