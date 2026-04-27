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

export const emailsApi = {
  list: (pageToken?: string) => {
    const url = pageToken
      ? `/api/emails?page_token=${encodeURIComponent(pageToken)}`
      : "/api/emails";
    return apiFetch<ApiEmailListResponse>(url);
  },
  get: (id: string) => apiFetch<ApiEmailDetail>(`/api/emails/${id}`),
  batchGet: (ids: string[]) =>
    apiFetch<ApiEmailDetail[]>("/api/emails/batch", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  attachmentUrl: (emailId: string, attachmentId: string, filename: string) =>
    `${API_BASE}/api/emails/${emailId}/attachments/${attachmentId}?filename=${encodeURIComponent(filename)}`,
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
