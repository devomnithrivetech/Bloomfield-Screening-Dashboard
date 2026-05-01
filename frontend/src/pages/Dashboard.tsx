import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Inbox, SearchX, Loader2, Mail, PlusCircle, ClipboardList, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import EmailRow from "@/components/EmailRow";
import EmailDetail from "@/components/EmailDetail";
import type { Email } from "@/data/mockEmails";
import { emailsApi, gmailApi, type ApiEmailDetail, type ApiDashboardStats } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Module-level session cache — survives React unmount/remount on navigation
// ---------------------------------------------------------------------------
interface DashboardCache {
  emails: Email[];
  nextPageToken: string | null;
  gmailConnected: boolean | null;
  stats: ApiDashboardStats | null;
  timestamp: number;
}
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let _cache: DashboardCache | null = null;
// Body cache persists across navigations — email bodies are immutable
const _bodyCache = new Map<string, Email>();

function isCacheFresh(): boolean {
  return !!_cache && Date.now() - _cache.timestamp < CACHE_TTL_MS;
}

const STATUS_RANK: Record<string, number> = {
  Unprocessed: 0,
  Processing: 1,
  Processed: 2,
};

// ---------------------------------------------------------------------------
// Helpers
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

  return {
    id: api.id,
    sender: api.sender,
    senderEmail: api.sender_email || "",
    subject: api.subject,
    date,
    time,
    body: api.body_text || api.preview,
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

  // Initialize from cache immediately — no loading flash on navigation back
  const [emails, setEmails] = useState<Email[]>(() => (isCacheFresh() ? _cache!.emails : []));
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    isCacheFresh() && _cache!.emails.length > 0 ? _cache!.emails[0].id : null
  );
  const [selectedEmailFull, setSelectedEmailFull] = useState<Email | null>(() =>
    isCacheFresh() && _cache!.emails.length > 0
      ? (_bodyCache.get(_cache!.emails[0].id) ?? null)
      : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Email[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(() => !isCacheFresh());
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(() =>
    isCacheFresh() ? _cache!.gmailConnected : null
  );
  const [nextPageToken, setNextPageToken] = useState<string | null>(() =>
    isCacheFresh() ? _cache!.nextPageToken : null
  );
  const [dashStats, setDashStats] = useState<ApiDashboardStats | null>(() =>
    isCacheFresh() ? _cache!.stats ?? null : null
  );

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetchBodies = useCallback(async (emailList: Email[]) => {
    const ids = emailList.filter((e) => !_bodyCache.has(e.id)).map((e) => e.id);
    if (!ids.length) return;
    try {
      const details = await emailsApi.batchGet(ids);
      details.forEach((d) => _bodyCache.set(d.id, apiToEmail(d)));
    } catch {
      // On-demand fetch handles misses when user selects the email
    }
  }, []);

  // Applies a successful inbox fetch result to state and the module-level cache.
  const applyInboxResult = useCallback(
    (
      listRes: Awaited<ReturnType<typeof emailsApi.list>>,
      statsRes: ApiDashboardStats,
      connected: boolean,
      isBackground: boolean,
    ) => {
      setGmailConnected(connected);
      setDashStats(statsRes);
      if (listRes.emails.length > 0) {
        const converted = listRes.emails.map(apiToEmail);
        setEmails(converted);
        setNextPageToken(listRes.next_page_token);
        _cache = {
          emails: converted,
          nextPageToken: listRes.next_page_token,
          gmailConnected: connected,
          stats: statsRes,
          timestamp: Date.now(),
        };
        if (!isBackground) {
          setSelectedId((prev) => prev ?? converted[0]?.id ?? null);
        }
        prefetchBodies(converted);
      } else if (!isBackground) {
        setEmails([]);
        setNextPageToken(null);
        setSelectedId(null);
        _cache = {
          emails: [],
          nextPageToken: null,
          gmailConnected: connected,
          stats: statsRes,
          timestamp: Date.now(),
        };
      }
    },
    [prefetchBodies],
  );

  const fetchEmails = useCallback(
    async (force = false) => {
      if (!force && isCacheFresh()) {
        // Cache is fresh — revalidate silently in the background
        void (async () => {
          try {
            const [statusRes, listRes, statsRes] = await Promise.all([
              gmailApi.getStatus(),
              emailsApi.list(),
              emailsApi.stats(),
            ]);
            applyInboxResult(listRes, statsRes, statusRes.connected, true);
          } catch { /* ignore background errors */ }
        })();
        return;
      }

      setLoading(true);
      try {
        const [statusRes, listRes, statsRes] = await Promise.all([
          gmailApi.getStatus(),
          emailsApi.list(),
          emailsApi.stats(),
        ]);
        applyInboxResult(listRes, statsRes, statusRes.connected, false);
      } catch {
        setGmailConnected(false);
        if (!isCacheFresh()) {
          setEmails([]);
          setSelectedId(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [applyInboxResult],
  );

  const handleReload = useCallback(async () => {
    setIsRefreshing(true);
    setSearchQuery("");
    setSearchResults(null);
    _cache = null; // invalidate so fetchEmails does a full reload
    await fetchEmails(true);
    setIsRefreshing(false);
  }, [fetchEmails]);

  const loadMoreEmails = useCallback(async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const listRes = await emailsApi.list(nextPageToken);
      const converted = listRes.emails.map(apiToEmail);
      setEmails((prev) => {
        const next = [...prev, ...converted];
        if (_cache) {
          _cache = { ..._cache, emails: next, nextPageToken: listRes.next_page_token, timestamp: Date.now() };
        }
        return next;
      });
      setNextPageToken(listRes.next_page_token);
      prefetchBodies(converted);
    } catch { /* Button stays visible — user can retry */ }
    finally {
      setLoadingMore(false);
    }
  }, [nextPageToken, loadingMore, prefetchBodies]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Gmail-powered search with 500 ms debounce
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const listRes = await emailsApi.list(undefined, q);
        const converted = listRes.emails.map(apiToEmail);
        setSearchResults(converted);
        if (converted.length > 0) setSelectedId(converted[0].id);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  // Serve selected email from persistent body cache or fetch on demand
  useEffect(() => {
    if (!selectedId) {
      setSelectedEmailFull(null);
      return;
    }
    if (_bodyCache.has(selectedId)) {
      setSelectedEmailFull(_bodyCache.get(selectedId)!);
      return;
    }
    let cancelled = false;
    emailsApi
      .get(selectedId)
      .then((detail) => {
        if (!cancelled) {
          const email = apiToEmail(detail);
          _bodyCache.set(selectedId, email);
          setSelectedEmailFull(email);
        }
      })
      .catch(() => {
        if (!cancelled) setSelectedEmailFull(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Merge volatile fields so status transitions reflect without re-fetching body
  const selectedEmail = emails.find((e) => e.id === selectedId) ?? null;
  const baseEmail = selectedEmailFull ?? selectedEmail;
  const rightPanelEmail =
    baseEmail && selectedEmail
      ? { ...baseEmail, status: selectedEmail.status, deal_id: selectedEmail.deal_id }
      : baseEmail;

  // Poll every 5 s while any email is "Processing"
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
            const statusAdvances = updatedRank > currentRank;
            const dealIdAppears = u.deal_id && u.deal_id !== email.deal_id;
            if (statusAdvances || dealIdAppears) {
              changed = true;
              if (_bodyCache.has(email.id)) {
                const cached = _bodyCache.get(email.id)!;
                _bodyCache.set(email.id, {
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

  const handleSendForProcessing = async (id: string) => {
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "Processing" as const } : e))
    );
    try {
      const result = await emailsApi.process(id);
      if (result.deal_id) {
        setEmails((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, status: "Processed" as const, deal_id: result.deal_id! }
              : e
          )
        );
      }
      navigate("/screened");
    } catch {
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

  const isSearchMode = !!searchQuery.trim();
  const displayedEmails = isSearchMode ? (searchResults ?? []) : emails;
  const isListLoading = loading || (isSearchMode && searchLoading);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Stats Bar */}
      <div className="h-[72px] bg-card border-b border-border px-6 flex items-center flex-shrink-0">
        {[
          {
            label: "Deals Screened",
            value: dashStats ? String(dashStats.total_screened) : "–",
            subtext: dashStats
              ? `${dashStats.screened_this_week} this week`
              : "all time",
            valueColor: "text-success",
          },
          {
            label: "Inbox This Week",
            value: dashStats ? String(dashStats.inbox_this_week) : "–",
            subtext: "new deal emails",
          },
          {
            label: "In Progress",
            value: dashStats ? String(dashStats.in_progress) : "–",
            subtext: "processing now",
            valueColor: dashStats && dashStats.in_progress > 0 ? "text-warning" : undefined,
          },
          {
            label: "Total Submitted",
            value: dashStats
              ? String(dashStats.total_screened + dashStats.in_progress)
              : "–",
            subtext: "emails analyzed",
          },
        ].map((stat, i) => (
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
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                {isSearchMode && searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                <Input
                  placeholder="Search emails by keyword, sender, property name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 bg-card"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleReload}
                disabled={loading || isRefreshing}
                className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground"
                title="Refresh inbox"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="px-4 pb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isSearchMode ? "Search Results" : "Inbox"}
            </span>
            {!isListLoading && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {displayedEmails.length}
              </Badge>
            )}
            {gmailConnected === true && !isSearchMode && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 ml-auto bg-success/10 text-success">
                Gmail
              </Badge>
            )}
          </div>

          <ScrollArea className="flex-1">
            {isListLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin opacity-50" />
                <span className="text-sm">
                  {isSearchMode ? "Searching Gmail…" : "Loading inbox…"}
                </span>
              </div>
            ) : displayedEmails.length > 0 ? (
              <>
                {displayedEmails.map((email) => (
                  <EmailRow
                    key={email.id}
                    email={email}
                    isSelected={selectedId === email.id}
                    onClick={() => setSelectedId(email.id)}
                  />
                ))}
                {nextPageToken && !isSearchMode && (
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
            ) : gmailConnected === false && !isSearchMode ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4 px-8 text-center">
                <Mail className="h-10 w-10 opacity-30" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground/70">Gmail not connected</p>
                  <p className="text-xs leading-relaxed">
                    Connect your Gmail account to start seeing deal emails here.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/settings")}
                  className="text-xs gap-2 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Connect Gmail in Settings
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <SearchX className="h-8 w-8 opacity-40" />
                <p className="text-sm">
                  {isSearchMode ? "No emails match your search" : "No emails in inbox"}
                </p>
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
              <div className="flex flex-col items-center gap-5 text-muted-foreground max-w-sm text-center">
                <div className="rounded-full bg-primary/5 p-5 border border-primary/10">
                  <Mail className="h-10 w-10 text-primary/40" />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-foreground/80">Connect your Gmail account</p>
                  <p className="text-sm leading-relaxed">
                    To view and screen deal emails, please connect your Gmail account in Settings.
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/settings")}
                  className="gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Go to Settings to Connect Gmail
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
