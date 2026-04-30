import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, Clock, Download,
  Loader2, Mail, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { screenedApi, type ScreenedEmail, type ApiPipelineStage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PIPELINE_LABELS: Record<string, string> = {
  email_received:        "Email Received",
  parsing_attachments:   "Attachments Extracted",
  extracting_financials: "AI Analysis",
  running_screener:      "Screener Generated",
  complete:              "Ready for Review",
};

const STAGE_ORDER = [
  "email_received",
  "parsing_attachments",
  "extracting_financials",
  "running_screener",
  "complete",
];

// Processing status → human-readable label
const STATUS_LABEL: Record<string, string> = {
  queued:                "Queued",
  email_received:        "Email Received",
  parsing_attachments:   "Processing Attachments",
  extracting_financials: "AI Analysis",
  running_screener:      "Generating Screener",
  complete:              "Ready for Review",
  failed:                "Failed",
};

const STATUS_BADGE: Record<string, string> = {
  queued:                "bg-muted text-muted-foreground border-0",
  email_received:        "bg-accent/15 text-accent-foreground border-0",
  parsing_attachments:   "bg-accent/15 text-accent-foreground border-0",
  extracting_financials: "bg-warning/15 text-warning border-0",
  running_screener:      "bg-warning/15 text-warning border-0",
  complete:              "bg-success/15 text-success border-0",
  failed:                "bg-destructive/15 text-destructive border-0",
};

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function buildPipeline(entry: ScreenedEmail): ApiPipelineStage[] {
  if (entry.pipeline && entry.pipeline.length > 0) {
    return entry.pipeline as ApiPipelineStage[];
  }
  // Derive a sensible pipeline from processing_status when no explicit stages exist
  const completedUpTo = STAGE_ORDER.indexOf(entry.processing_status);
  return STAGE_ORDER.map((stage, i) => ({
    stage,
    status:
      i < completedUpTo ? "completed"
      : i === completedUpTo ? "in_progress"
      : "pending",
    started_at: null,
    finished_at: null,
    detail: null,
  }));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  PIPELINE TRACK (reused from DealDetail)
// ─────────────────────────────────────────────────────────────────────────────

function PipelineTrack({ pipeline }: { pipeline: ApiPipelineStage[] }) {
  const completedCount = pipeline.filter((s) => s.status === "completed").length;
  return (
    <div className="flex items-start justify-between relative mt-3">
      <div className="absolute top-3 left-3 right-3 h-0.5 bg-border z-0" />
      <div
        className="absolute top-3 left-3 h-0.5 bg-primary z-0 transition-all duration-500"
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
              {stage.status === "completed"   && <Check   className="h-3.5 w-3.5 text-primary-foreground" />}
              {stage.status === "in_progress" && <Loader2 className="h-3.5 w-3.5 text-accent-foreground animate-spin" />}
              {stage.status === "pending"     && <Clock   className="h-3 w-3 text-muted-foreground" />}
            </div>
            <span className="text-[10px] font-medium text-foreground mt-1.5 text-center leading-tight max-w-[70px]">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CARD
// ─────────────────────────────────────────────────────────────────────────────

function ScreenedCard({ entry }: { entry: ScreenedEmail }) {
  const navigate = useNavigate();
  const pipeline = buildPipeline(entry);
  const isComplete = entry.processing_status === "complete";
  const isFailed   = entry.processing_status === "failed";
  const isActive   = !isComplete && !isFailed;

  const displayTitle = entry.screened_title ?? entry.subject;

  return (
    <Card className={cn(
      "transition-shadow hover:shadow-md",
      isComplete && "border-l-[3px] border-l-success",
      isFailed   && "border-l-[3px] border-l-destructive",
      isActive   && "border-l-[3px] border-l-accent",
    )}>
      <CardContent className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
              {displayTitle}
            </h3>
            {entry.screened_title && entry.screened_title !== entry.subject && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {entry.subject}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {entry.sender}
                {entry.sender_email && ` <${entry.sender_email}>`}
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                {entry.received_at ? formatDate(entry.received_at) : formatDate(entry.sent_for_screening_at)}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <Badge className={cn("text-[10px] font-semibold px-2 py-0.5", STATUS_BADGE[entry.processing_status] ?? STATUS_BADGE.queued)}>
              {STATUS_LABEL[entry.processing_status] ?? entry.processing_status}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              Sent {formatDateTime(entry.sent_for_screening_at)}
            </span>
          </div>
        </div>

        {/* Pipeline progress track */}
        <PipelineTrack pipeline={pipeline} />

        {/* Action row — only shown when complete */}
        {isComplete && entry.deal_id && (
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            {entry.screener_s3_key && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => window.open(screenedApi.screenerUrl(entry.deal_id!), "_blank")}
              >
                <Download className="h-3.5 w-3.5" />
                Download Screener
              </Button>
            )}
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-xs ml-auto"
              onClick={() => navigate(`/deal/${entry.deal_id}`)}
            >
              Screening Results
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {isFailed && (
          <div className="pt-1 border-t border-border">
            <p className="text-xs text-destructive">
              Processing failed. Select the email from the inbox and retry.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE
// ─────────────────────────────────────────────────────────────────────────────

const ScreenedEmails = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [entries, setEntries] = useState<ScreenedEmail[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await screenedApi.list();
      setEntries(data);
    } catch {
      if (!silent) {
        toast({ title: "Could not load screening queue", variant: "destructive" });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Poll every 5 s while any entry is actively processing
  const hasActive = entries.some(
    (e) => e.processing_status !== "complete" && e.processing_status !== "failed",
  );
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => fetchEntries(true), 5000);
    return () => clearInterval(timer);
  }, [hasActive, fetchEntries]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>
            <span className="text-muted-foreground/40">/</span>
            <h1 className="text-xl font-semibold text-foreground">Screening Queue</h1>
            {entries.length > 0 && (
              <Badge variant="secondary" className="text-[11px] px-2">{entries.length}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActive && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Live updates
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => fetchEntries()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin opacity-40" />
            <span className="text-sm">Loading screening queue…</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <Mail className="h-12 w-12 opacity-30" />
            <p className="text-sm">No emails have been sent for screening yet.</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              Go to Inbox
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <ScreenedCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenedEmails;
