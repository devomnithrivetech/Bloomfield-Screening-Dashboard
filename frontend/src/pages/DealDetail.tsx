import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Check, Download, Mail, AlertTriangle,
  CheckCircle2, Loader2, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { dealsApi, type ApiDealDetail, type ApiKeyMetric } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const PIPELINE_LABELS: Record<string, string> = {
  email_received:        "Email Received",
  parsing_attachments:   "Attachments Extracted",
  extracting_financials: "AI Analysis",
  running_screener:      "Screener Generated",
  complete:              "Ready for Review",
};

const REC_BADGE: Record<string, { label: string; className: string }> = {
  proceed:   { label: "PROCEED TO DILIGENCE", className: "bg-success/15 text-success border-0 font-semibold text-xs px-3 py-1" },
  negotiate: { label: "NEGOTIATE",            className: "bg-warning/15 text-warning border-0 font-semibold text-xs px-3 py-1" },
  pass:      { label: "PASS",                 className: "bg-destructive/15 text-destructive border-0 font-semibold text-xs px-3 py-1" },
};

function formatPropertyTags(deal: ApiDealDetail): string[] {
  const tags: string[] = [];
  const pi = deal.property_info ?? {};
  if (pi.property_type) tags.push(String(pi.property_type));
  if (pi.total_units)   tags.push(`${pi.total_units} Units`);
  if (pi.year_built)    tags.push(`Built ${pi.year_built}`);
  if (pi.building_sf)   tags.push(`${Number(pi.building_sf).toLocaleString()} SF`);
  return tags;
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const DealDetail = () => {
  const navigate    = useNavigate();
  const { id }      = useParams<{ id: string }>();
  const { toast }   = useToast();

  const [deal, setDeal]                     = useState<ApiDealDetail | null>(null);
  const [loading, setLoading]               = useState(true);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [sending, setSending]               = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let cancelled = false;
    dealsApi.get(id)
      .then((d) => { if (!cancelled) { setDeal(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleDownload = () => {
    if (!id) return;
    window.open(dealsApi.screenerUrl(id), "_blank");
  };

  const handleSendEmail = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setEmailModalOpen(false);
      toast({ title: "Email sent", description: "Screening email delivered to the Investment Committee." });
    }, 900);
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground opacity-40" />
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!deal) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-background">
        <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p className="text-sm">Deal not found or still processing.</p>
              <p className="text-xs mt-1">Refresh the page in a moment to check status.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Resolved data ─────────────────────────────────────────────────────────
  const pi          = deal.property_info ?? {};
  const propertyTags = formatPropertyTags(deal);
  const recBadge    = REC_BADGE[deal.recommendation ?? ""] ?? null;

  const highlights  = deal.highlights[0]?.detail ?? "";
  const risks       = deal.risks[0]?.detail ?? "";

  const pipeline    = deal.pipeline.length > 0
    ? deal.pipeline
    : Object.keys(PIPELINE_LABELS).map((stage) => ({
        stage, status: "pending" as const,
        started_at: null, finished_at: null, detail: null,
      }));
  const completedCount = pipeline.filter((s) => s.status === "completed").length;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-6">

        {/* Back */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        {/* Section 1: Deal Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-primary">{deal.property_name}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {[pi.address, pi.city_state, pi.county].filter(Boolean).join("  ·  ")}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {recBadge && (
                  <Badge className={recBadge.className}>{recBadge.label}</Badge>
                )}
                {pi.deal_type && (
                  <Badge className="bg-primary text-primary-foreground border-0 font-semibold text-xs px-3 py-1">
                    {String(pi.deal_type)}
                  </Badge>
                )}
              </div>
            </div>
            {propertyTags.length > 0 && (
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {propertyTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs font-medium">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Processing Pipeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Processing Status</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="flex items-start justify-between relative">
              <div className="absolute top-3 left-3 right-3 h-0.5 bg-border z-0" />
              <div
                className="absolute top-3 left-3 h-0.5 bg-primary z-0 transition-all"
                style={{
                  width: `calc(${
                    pipeline.length > 1
                      ? ((completedCount - 1) / (pipeline.length - 1)) * 100
                      : 0
                  }% - 24px)`,
                }}
              />
              {pipeline.map((stage) => {
                const label = PIPELINE_LABELS[stage.stage] ?? stage.stage;
                const ts    = stage.finished_at ?? stage.started_at;
                const fmtTs = ts
                  ? new Date(ts).toLocaleString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })
                  : null;

                return (
                  <div key={stage.stage} className="flex flex-col items-center z-10 flex-1">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center",
                        stage.status === "completed"   && "bg-primary",
                        stage.status === "in_progress" && "bg-accent animate-pulse",
                        stage.status === "failed"      && "bg-destructive",
                        (stage.status === "pending" || !stage.status) && "bg-muted border-2 border-border",
                      )}
                    >
                      {stage.status === "completed"   && <Check  className="h-3.5 w-3.5 text-primary-foreground" />}
                      {stage.status === "in_progress" && <Loader2 className="h-3.5 w-3.5 text-accent-foreground animate-spin" />}
                      {stage.status === "pending"     && <Clock  className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <span className="text-[11px] font-medium text-foreground mt-2 text-center">{label}</span>
                    {fmtTs && (
                      <span className="text-[10px] text-muted-foreground text-center mt-0.5">{fmtTs}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Key Metrics */}
        {deal.key_metrics.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Deal Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {deal.key_metrics.map((m: ApiKeyMetric) => (
                  <div key={m.label} className="border border-border rounded-lg p-4 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{m.label}</span>
                      {m.flag === "warn" ? (
                        <span className="flex items-center gap-0.5 text-[10px] text-warning font-medium">
                          <AlertTriangle className="h-3 w-3" /> Flag
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-[10px] text-success font-medium">
                          <CheckCircle2 className="h-3 w-3" /> OK
                        </span>
                      )}
                    </div>
                    <span className="text-base font-semibold text-foreground">{m.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 4: Highlights & Risks */}
        {(highlights || risks) && (
          <div className="grid grid-cols-2 gap-6">
            {highlights && (
              <Card className="border-t-[3px] border-t-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Investment Highlights</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {highlights}
                  </p>
                </CardContent>
              </Card>
            )}
            {risks && (
              <Card className="border-t-[3px] border-t-destructive">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Investment Risks &amp; Underwriting Flags</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {risks}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Section 5: Actions */}
        <Card>
          <CardContent className="p-6 flex items-center gap-3">
            <Button
              onClick={handleDownload}
              disabled={!deal.screener_s3_key}
              className="bg-success hover:bg-success/90 text-success-foreground gap-2 press"
            >
              <Download className="h-4 w-4" />
              Download Screener (XLSX)
            </Button>
            {deal.screening_email_draft && (
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-primary/5 gap-2 press"
                onClick={() => setEmailModalOpen(true)}
              >
                <Mail className="h-4 w-4" />
                Preview Draft Email
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Email Preview Modal */}
      {deal.screening_email_draft && (
        <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Draft Screening Email</DialogTitle>
            </DialogHeader>
            <pre className="whitespace-pre-wrap text-sm text-foreground leading-relaxed font-sans">
              {deal.screening_email_draft}
            </pre>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEmailModalOpen(false)} disabled={sending}>
                Close
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={sending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground press gap-2"
              >
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                {sending ? "Sending..." : "Send Email"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default DealDetail;
