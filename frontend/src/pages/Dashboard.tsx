import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Inbox, SearchX, Loader2, Mail, PlusCircle, ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import EmailRow from "@/components/EmailRow";
import EmailDetail from "@/components/EmailDetail";
import { mockEmails, type Email } from "@/data/mockEmails";
import { emailsApi, gmailApi, type ApiEmailDetail } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const stats = [
  { label: "Deals This Week", value: "8", subtext: "emails received" },
  { label: "Screened", value: "3", subtext: "2 this week", valueColor: "text-success" },
  { label: "Pending Review", value: "2", subtext: "processing now", valueColor: "text-warning" },
  { label: "Avg. Loan Size", value: "$14.2M", subtext: "across active deals" },
];

// ---------------------------------------------------------------------------
// Transform Gmail API response → the Email shape used by components
// ---------------------------------------------------------------------------
function formatSize(bytes: number | null): string {
  if (!bytes) return "–";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_MAP = {
  unprocessed: "Unprocessed",
  processing: "Processing",
  processed: "Processed",
} as const;

function apiToEmail(api: ApiEmailDetail): Email {
  const dt = new Date(api.received_at);
  const date = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const body = api.body_text || api.preview;

  return {
    id: api.id,
    sender: api.sender,
    senderEmail: api.sender_email || "",
    subject: api.subject,
    date,
    time,
    body,
    bodyHtml: api.body_html ?? undefined,
    snippet: api.preview,
    attachments: api.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      type: a.type,
      size: formatSize(a.size_bytes),
    })),
    status: STATUS_MAP[api.status] ?? "Unprocessed",
    deal_id: api.deal_id ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEmailFull, setSelectedEmailFull] = useState<Email | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  // Body cache keyed by email ID — populated by background batch pre-fetch
  const emailBodyCache = useRef(new Map<string, Email>());

  // Pre-fetch full bodies for a list of emails using a single batch request.
  // Results go into the cache so subsequent clicks are instant.
  const prefetchBodies = useCallback(async (emailList: Email[]) => {
    const ids = emailList
      .filter((e) => !emailBodyCache.current.has(e.id))
      .map((e) => e.id);
    if (!ids.length) return;
    try {
      const details = await emailsApi.batchGet(ids);
      details.forEach((d) => emailBodyCache.current.set(d.id, apiToEmail(d)));
    } catch {
      // On-demand fetch handles any misses when user selects the email
    }
  }, []);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, listRes] = await Promise.all([
        gmailApi.getStatus(),
        emailsApi.list(),
      ]);
      setGmailConnected(statusRes.connected);
      if (listRes.emails.length > 0) {
        const converted = listRes.emails.map(apiToEmail);
        setEmails(converted);
        setNextPageToken(listRes.next_page_token);
        setSelectedId(converted[0]?.id ?? null);
        // Kick off background pre-fetch — don't await so inbox renders immediately
        prefetchBodies(converted);
      } else {
        setEmails(mockEmails);
        setSelectedId(mockEmails[0]?.id ?? null);
      }
    } catch {
      setGmailConnected(false);
      setEmails(mockEmails);
      setSelectedId(mockEmails[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, [prefetchBodies]);

  const loadMoreEmails = useCallback(async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const listRes = await emailsApi.list(nextPageToken);
      const converted = listRes.emails.map(apiToEmail);
      setEmails((prev) => [...prev, ...converted]);
      setNextPageToken(listRes.next_page_token);
      prefetchBodies(converted);
    } catch {
      // Button stays visible — user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [nextPageToken, loadingMore, prefetchBodies]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // When selected email changes, serve from cache (instant) or fetch on demand.
  useEffect(() => {
    if (!selectedId) {
      setSelectedEmailFull(null);
      return;
    }
    if (emailBodyCache.current.has(selectedId)) {
      setSelectedEmailFull(emailBodyCache.current.get(selectedId)!);
      return;
    }
    let cancelled = false;
    emailsApi.get(selectedId)
      .then((detail) => {
        if (!cancelled) {
          const email = apiToEmail(detail);
          emailBodyCache.current.set(selectedId, email);
          setSelectedEmailFull(email);
        }
      })
      .catch(() => {
        if (!cancelled) setSelectedEmailFull(null);
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  const selectedEmail = emails.find((e) => e.id === selectedId) || null;
  // selectedEmailFull has the full body but may be stale after optimistic status updates.
  // Merge volatile fields (status, deal_id) from the live emails list so Processing→Processed
  // transitions always show in the right panel without re-fetching the body.
  const baseEmail = selectedEmailFull ?? selectedEmail;
  const rightPanelEmail = baseEmail && selectedEmail
    ? { ...baseEmail, status: selectedEmail.status, deal_id: selectedEmail.deal_id }
    : baseEmail;

  // Poll every 5 s while any email is in "Processing" state so the dashboard
  // auto-updates when the backend pipeline completes — even if the original
  // HTTP request was started in a now-unmounted component instance.
  //
  // STATUS_RANK enforces a one-way ratchet: polling can only advance an email's
  // status (Unprocessed → Processing → Processed), never revert it.  Without
  // this guard, a transient Supabase miss (e.g. the write hasn't landed yet)
  // would overwrite the optimistic "Processing" state with "Unprocessed",
  // causing the "Send for Processing" button to re-appear mid-flight.
  const STATUS_RANK: Record<string, number> = {
    Unprocessed: 0,
    Processing: 1,
    Processed: 2,
  };
  const hasProcessing = emails.some((e) => e.status === "Processing");
  useEffect(() => {
    if (!hasProcessing) return;
    const poll = async () => {
      try {
        const listRes = await emailsApi.list();
        const updated = listRes.emails.map(apiToEmail);
        setEmails((prev) => {
          let changed = false;
          const next = prev.map((email) => {
            const u = updated.find((u) => u.id === email.id);
            if (!u) return email;
            const currentRank = STATUS_RANK[email.status] ?? 0;
            const updatedRank = STATUS_RANK[u.status] ?? 0;
            // Only apply if status advances OR deal_id is newly available
            const statusAdvances = updatedRank > currentRank;
            const dealIdAppears = u.deal_id && u.deal_id !== email.deal_id;
            if (statusAdvances || dealIdAppears) {
              changed = true;
              // Keep body cache in sync so the right panel reflects the new status
              if (emailBodyCache.current.has(email.id)) {
                const cached = emailBodyCache.current.get(email.id)!;
                emailBodyCache.current.set(email.id, {
                  ...cached,
                  status: statusAdvances ? u.status : email.status,
                  deal_id: u.deal_id ?? email.deal_id,
                });
              }
              return {
                ...email,
                status: statusAdvances ? u.status : email.status,
                deal_id: u.deal_id ?? email.deal_id,
              };
            }
            return email;
          });
          return changed ? next : prev;
        });
      } catch { /* ignore transient poll errors */ }
    };
    const timer = setInterval(poll, 5000);
    return () => clearInterval(timer);
  }, [hasProcessing]);

  const filteredEmails = emails.filter((email) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      email.sender.toLowerCase().includes(q) ||
      email.subject.toLowerCase().includes(q) ||
      email.snippet.toLowerCase().includes(q)
    );
  });

  const handleSendForProcessing = async (id: string) => {
    // Optimistic update — show "Processing" immediately
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "Processing" as const } : e))
    );
    try {
      const result = await emailsApi.process(id);
      // The endpoint now returns immediately (pipeline runs in the background).
      // deal_id is null at this point — the polling loop will pick up the final
      // "Processed" state + deal_id once the background task completes.
      // If (for legacy reasons) a deal_id is already present, advance the status.
      if (result.deal_id) {
        setEmails((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, status: "Processed" as const, deal_id: result.deal_id! }
              : e
          )
        );
      }
      // Navigate to the Screening Queue so the user can watch live progress
      navigate("/screened");
    } catch {
      // Revert on failure
      setEmails((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: "Unprocessed" as const } : e))
      );
      toast({
        title: "Processing failed",
        description: "Could not process this email. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Stats Bar */}
      <div className="h-[72px] bg-card border-b border-border px-6 flex items-center flex-shrink-0">
        {stats.map((stat, i) => (
          <div key={stat.label} className="flex items-center">
            {i > 0 && <div className="w-px h-10 bg-border mx-6" />}
            <div className="flex flex-col animate-fade-in">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {stat.label}
              </span>
              <span className={`text-[22px] font-semibold leading-tight tabular-nums ${stat.valueColor || "text-primary"}`}>
                {stat.value}
              </span>
              <span className="text-[11px] text-muted-foreground">{stat.subtext}</span>
            </div>
          </div>
        ))}
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs font-medium border-primary/30 text-primary hover:bg-primary/5 hover:border-primary"
            onClick={() => navigate("/screened")}
          >
            <ClipboardList className="h-4 w-4" />
            Screening Queue
          </Button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel */}
        <div className="w-[38%] border-r border-border bg-background flex flex-col">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search emails by keyword, sender, property name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
          </div>

          <div className="px-4 pb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Inbox
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
              {filteredEmails.length}
            </Badge>
            {gmailConnected === true && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 ml-auto bg-success/10 text-success">
                Gmail
              </Badge>
            )}
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin opacity-50" />
                <span className="text-sm">Loading inbox…</span>
              </div>
            ) : filteredEmails.length > 0 ? (
              <>
                {filteredEmails.map((email) => (
                  <EmailRow
                    key={email.id}
                    email={email}
                    isSelected={selectedId === email.id}
                    onClick={() => setSelectedId(email.id)}
                  />
                ))}
                {nextPageToken && !searchQuery && (
                  <div className="px-3 py-3 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground hover:text-foreground gap-1.5"
                      onClick={loadMoreEmails}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlusCircle className="h-4 w-4" />
                      )}
                      <span className="text-xs">
                        {loadingMore ? "Loading…" : "Load 20 more"}
                      </span>
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <SearchX className="h-8 w-8 opacity-40" />
                <p className="text-sm">No emails match your search</p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Panel */}
        <div className="w-[62%] bg-card flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin opacity-30" />
            </div>
          ) : rightPanelEmail ? (
            <EmailDetail
              email={rightPanelEmail}
              onSendForProcessing={handleSendForProcessing}
            />
          ) : gmailConnected === false ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-muted-foreground max-w-xs text-center">
                <Mail className="h-12 w-12 opacity-30" />
                <p className="text-sm">Connect your Gmail to see deal emails in your inbox</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/settings")}
                  className="text-xs"
                >
                  Go to Settings
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Inbox className="h-12 w-12 opacity-30" />
                <p className="text-sm">Select an email to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
