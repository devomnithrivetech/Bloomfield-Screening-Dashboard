import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Paperclip, Table2, Download, CheckCircle2, Loader2, ArrowRight, FileText,
  Upload, X, FileSpreadsheet, AlertCircle, GripHorizontal,
} from "lucide-react";
import { emailsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Email } from "@/data/mockEmails";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ALLOWED_EXTENSIONS = new Set([".pdf", ".xlsx", ".xls", ".csv", ".docx", ".doc"]);
const MAX_EXTRA_FILES = 10;
const MAX_BYTES = 50 * 1024 * 1024;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function fileIcon(name: string) {
  return extOf(name) === ".pdf"
    ? <FileText className="h-4 w-4 text-red-400 flex-shrink-0" />
    : <FileSpreadsheet className="h-4 w-4 text-green-500 flex-shrink-0" />;
}

interface FileEntry { file: File; id: string }

function prepareHtmlForIframe(html: string): string {
  const withTargets = html.replace(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
  const script = [
    '<script>',
    'document.addEventListener("click", function(e) {',
    '  var a = e.target ? e.target.closest("a") : null;',
    '  if (!a || !a.href) return;',
    '  e.preventDefault();',
    '  window.parent.postMessage({ type: "iframe-link-click", url: a.href }, "*");',
    '});',
    '<' + '/script>',
  ].join('\n');
  return withTargets + script;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface EmailDetailProps {
  email: Email;
  onSendForProcessing: (id: string, extraFiles: File[], instructions: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const EmailDetail = ({ email, onSendForProcessing }: EmailDetailProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Confirm-processing dialog state
  const [showConfirm, setShowConfirm]         = useState(false);
  const [extraFiles, setExtraFiles]           = useState<FileEntry[]>([]);
  const [instructions, setInstructions]       = useState("");
  const [fileDragOver, setFileDragOver]       = useState(false);
  const [fileError, setFileError]             = useState<string | null>(null);
  const fileInputRef                          = useRef<HTMLInputElement>(null);

  // Summarise state
  const [summarizeState, setSummarizeState]   = useState<"idle" | "loading" | "ready">("idle");
  const [summary, setSummary]                 = useState<string | null>(null);
  const [showSummary, setShowSummary]         = useState(false);
  const [summaryPos, setSummaryPos]           = useState({ x: 0, y: 0 });
  const dragState                             = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // External link interception from sandboxed iframe
  const [pendingUrl, setPendingUrl]           = useState<string | null>(null);

  // Reset summarize when email changes
  useEffect(() => {
    setSummarizeState("idle");
    setSummary(null);
    setShowSummary(false);
  }, [email.id]);

  // Listen for link-click messages from the sandboxed iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "iframe-link-click" && typeof e.data.url === "string") {
        setPendingUrl(e.data.url);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ── Extra-file helpers ────────────────────────────────────────────────────
  const validateAndAdd = useCallback((incoming: FileList | File[]) => {
    setFileError(null);
    const list = Array.from(incoming);
    const invalid = list.filter((f) => !ALLOWED_EXTENSIONS.has(extOf(f.name)));
    if (invalid.length) {
      setFileError(`Unsupported type: ${invalid.map(f => f.name).join(", ")}. Allowed: PDF, XLSX, XLS, CSV, DOCX, DOC.`);
      return;
    }
    const oversized = list.filter((f) => f.size > MAX_BYTES);
    if (oversized.length) {
      setFileError(`File too large: ${oversized.map(f => f.name).join(", ")}. Max 50 MB each.`);
      return;
    }
    setExtraFiles((prev) => {
      const next = [
        ...prev,
        ...list.map((f) => ({ file: f, id: `${f.name}-${f.size}-${Date.now()}` })),
      ];
      if (next.length > MAX_EXTRA_FILES) {
        setFileError(`Maximum ${MAX_EXTRA_FILES} additional files.`);
        return prev;
      }
      return next;
    });
  }, []);

  const removeFile = (id: string) => setExtraFiles((prev) => prev.filter((f) => f.id !== id));

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setFileDragOver(true); }, []);
  const onDragLeave = useCallback(() => setFileDragOver(false), []);
  const onDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setFileDragOver(false);
    if (e.dataTransfer.files.length) validateAndAdd(e.dataTransfer.files);
  }, [validateAndAdd]);

  const openConfirm = () => {
    setExtraFiles([]);
    setInstructions("");
    setFileError(null);
    setShowConfirm(true);
  };

  const handleConfirmProcess = () => {
    onSendForProcessing(email.id, extraFiles.map(e => e.file), instructions);
    setShowConfirm(false);
  };

  // ── Summary drag handlers ─────────────────────────────────────────────────
  const onSummaryDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: summaryPos.x,
      origY: summaryPos.y,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      setSummaryPos({
        x: Math.max(0, dragState.current.origX + ev.clientX - dragState.current.startX),
        y: Math.max(0, dragState.current.origY + ev.clientY - dragState.current.startY),
      });
    };

    const onUp = () => {
      dragState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [summaryPos.x, summaryPos.y]);

  // ── Summarise handler ─────────────────────────────────────────────────────
  const handleSummarize = useCallback(async () => {
    // If already loaded, just (re)show the window
    if (summarizeState === "ready" && summary) {
      setSummaryPos({
        x: Math.max(window.innerWidth - 450, 20),
        y: 80,
      });
      setShowSummary(true);
      return;
    }

    if (summarizeState !== "idle") return;

    setSummarizeState("loading");
    try {
      const { summary: text } = await emailsApi.summarize(email.id);
      setSummary(text || "No summary could be generated.");
      setSummarizeState("ready");
      setSummaryPos({
        x: Math.max(window.innerWidth - 450, 20),
        y: 80,
      });
      setShowSummary(true);
    } catch {
      setSummarizeState("idle");
      toast({
        title: "Summary failed",
        description: "Could not generate a summary. Please try again.",
        variant: "destructive",
      });
    }
  }, [summarizeState, summary, email.id, toast]);

  const summarizeBtn = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSummarize}
      disabled={summarizeState === "loading"}
      className="gap-2"
    >
      {summarizeState === "loading" ? (
        <><Loader2 className="h-4 w-4 animate-spin" />Summarising...</>
      ) : summarizeState === "ready" ? (
        <><FileText className="h-4 w-4" />Summary</>
      ) : (
        <><FileText className="h-4 w-4" />Summarise</>
      )}
    </Button>
  );

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-lg font-semibold text-primary leading-snug">{email.subject}</h2>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[13px] text-muted-foreground">
              {email.sender.split(",")[0]} &lt;{email.senderEmail}&gt;
            </span>
            <span className="text-[13px] text-muted-foreground">
              {email.date} at {email.time}
            </span>
          </div>
        </div>

        {/* Body + Attachments */}
        <ScrollArea className="flex-1 px-6 py-5">
          {email.bodyHtml ? (
            <iframe
              srcDoc={prepareHtmlForIframe(email.bodyHtml)}
              sandbox="allow-same-origin allow-scripts allow-popups"
              width="100%"
              style={{ height: "600px", border: "none" }}
              title="Email content"
            />
          ) : (
            <div className="whitespace-pre-line text-sm text-foreground leading-relaxed">
              {email.body}
            </div>
          )}

          {email.attachments.length > 0 && (
            <div className="mt-6 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Attachments
              </span>
              <div className="flex flex-wrap gap-3 mt-2">
                {email.attachments.map((att) => (
                  <div
                    key={att.filename}
                    className={cn(
                      "flex items-center gap-3 border rounded-lg px-4 py-3 min-w-[240px]",
                      att.type === "excel" && "border-l-[3px] border-l-success",
                      att.type === "pdf"   && "border-l-[3px] border-l-destructive"
                    )}
                  >
                    {att.type === "excel" ? (
                      <Table2 className="h-5 w-5 text-success flex-shrink-0" />
                    ) : (
                      <Paperclip className="h-5 w-5 text-destructive flex-shrink-0" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{att.filename}</span>
                      <span className="text-xs text-muted-foreground">{att.size}</span>
                    </div>
                    {att.id ? (
                      <a
                        href={emailsApi.attachmentUrl(email.id, att.id, att.filename)}
                        download={att.filename}
                        className="ml-auto text-xs text-accent hover:underline flex items-center gap-1 flex-shrink-0"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </a>
                    ) : (
                      <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                        <Download className="h-3 w-3" />
                        Download
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Actions Bar */}
        <div className="border-t border-border px-6 py-4 bg-card">
          {email.status === "Unprocessed" && (
            <div className="flex items-center gap-3">
              {summarizeBtn}
              <Button
                onClick={openConfirm}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Send for Processing
              </Button>
            </div>
          )}

          {email.status === "Processing" && (
            <div className="flex items-center gap-3">
              {summarizeBtn}
              <Button disabled variant="outline" size="sm" className="gap-2 ml-auto">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI analysis in progress…
              </Button>
            </div>
          )}

          {email.status === "Processed" && (
            <div className="flex items-center gap-3">
              {summarizeBtn}
              <Badge className="bg-success/15 text-success border-0 gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Processed
              </Badge>
              <Button
                size="sm"
                onClick={() => navigate(`/deal/${email.deal_id ?? email.id}`)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 ml-auto"
              >
                Screening Results
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm Processing Dialog (rich form) ─────────────────────────── */}
      <Dialog open={showConfirm} onOpenChange={(open) => { if (!open) setShowConfirm(false); }}>
        <DialogContent className="max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-base font-semibold">Send for AI Screening</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This email and its{" "}
              <span className="font-medium text-foreground">
                {email.attachments.length} attachment{email.attachments.length !== 1 ? "s" : ""}
              </span>{" "}
              will be sent to the AI pipeline. Optionally add extra documents or instructions below.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-1">
            {/* Additional documents */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Additional Documents
                <span className="ml-1 font-normal text-muted-foreground">
                  (optional — PDF, XLSX, XLS, CSV, DOCX, DOC, max 50 MB each)
                </span>
              </Label>

              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1.5",
                  "rounded-lg border-2 border-dashed px-4 py-4 text-center",
                  "cursor-pointer transition-colors select-none",
                  fileDragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30",
                )}
              >
                <Upload className="h-6 w-6 text-muted-foreground/60" />
                <p className="text-xs font-medium text-foreground/80">
                  Drag & drop files, or click to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.csv,.docx,.doc"
                  className="sr-only"
                  onChange={(e) => e.target.files && validateAndAdd(e.target.files)}
                />
              </div>

              {extraFiles.length > 0 && (
                <ul className="space-y-1">
                  {extraFiles.map(({ file, id }) => (
                    <li
                      key={id}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5"
                    >
                      {fileIcon(file.name)}
                      <span className="flex-1 truncate text-xs font-medium">{file.name}</span>
                      <span className="text-[11px] text-muted-foreground flex-shrink-0">
                        {fmtBytes(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFile(id); }}
                        className="ml-1 rounded p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {fileError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}
            </div>

            {/* Additional instructions */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm-instructions" className="text-xs font-medium">
                Additional Instructions
                <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
              </Label>
              <textarea
                id="confirm-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Focus on the T-12 NOI and flag any occupancy trends. The sponsor has indicated there are no management fees — treat this as a red flag."
                rows={4}
                className={[
                  "w-full rounded-md border border-input bg-background px-3 py-2",
                  "text-sm placeholder:text-muted-foreground resize-none",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                ].join(" ")}
              />
              <p className="text-[11px] text-muted-foreground">
                These instructions are injected directly into the analyst prompt and take highest priority.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmProcess}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground min-w-[140px]"
            >
              Confirm &amp; Process
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── External Link Confirmation ─────────────────────────────────────── */}
      <AlertDialog open={!!pendingUrl} onOpenChange={(open) => { if (!open) setPendingUrl(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open External Link?</AlertDialogTitle>
            <AlertDialogDescription className="break-all">
              You are about to leave the app and visit an external website:
              <span className="block mt-2 font-medium text-foreground">{pendingUrl}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingUrl(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingUrl) window.open(pendingUrl, "_blank", "noopener,noreferrer");
                setPendingUrl(null);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Open Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Draggable Summary Window (no backdrop blur) ────────────────────── */}
      {showSummary && summary && (
        <div
          style={{
            position: "fixed",
            left: summaryPos.x,
            top: summaryPos.y,
            width: 400,
            zIndex: 9999,
          }}
          className="rounded-xl border border-border bg-card shadow-2xl flex flex-col"
        >
          {/* Drag handle / header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-border cursor-grab active:cursor-grabbing select-none rounded-t-xl bg-muted/40"
            onMouseDown={onSummaryDragStart}
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="text-sm font-semibold text-foreground">Email Summary</span>
            </div>
            <button
              onClick={() => setShowSummary(false)}
              className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
              aria-label="Close summary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable content */}
          <div
            className="overflow-y-auto px-4 py-3 text-sm text-foreground leading-relaxed"
            style={{ maxHeight: 280 }}
          >
            {summary}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-border rounded-b-xl">
            <p className="text-[11px] text-muted-foreground">AI-generated · drag to move · cached after first load</p>
          </div>
        </div>
      )}
    </>
  );
};

export default EmailDetail;
