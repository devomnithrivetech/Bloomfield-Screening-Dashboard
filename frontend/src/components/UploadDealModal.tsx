import { useCallback, useRef, useState } from "react";
import { X, Upload, FileText, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { uploadsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface UploadDealModalProps {
  open: boolean;
  onClose: () => void;
}

interface FileEntry {
  file: File;
  id: string;
}

const ALLOWED_EXTENSIONS = new Set([".pdf", ".xlsx", ".xls", ".csv", ".docx", ".doc"]);
const MAX_FILES = 10;
const MAX_BYTES = 50 * 1024 * 1024;

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name: string) {
  const e = ext(name);
  if (e === ".pdf") return <FileText className="h-4 w-4 text-red-400 flex-shrink-0" />;
  return <FileSpreadsheet className="h-4 w-4 text-green-500 flex-shrink-0" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function UploadDealModal({ open, onClose }: UploadDealModalProps) {
  const { toast } = useToast();
  const navigate  = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [subject,     setSubject]     = useState("");
  const [sender,      setSender]      = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [bodyText,    setBodyText]    = useState("");
  const [files,       setFiles]       = useState<FileEntry[]>([]);
  const [dragOver,    setDragOver]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // ------------------------------------------------------------------
  // File helpers
  // ------------------------------------------------------------------
  const validateAndAdd = useCallback(
    (incoming: FileList | File[]) => {
      setError(null);
      const list = Array.from(incoming);
      const invalid = list.filter((f) => !ALLOWED_EXTENSIONS.has(ext(f.name)));
      if (invalid.length) {
        setError(`Unsupported file type: ${invalid.map((f) => f.name).join(", ")}. Allowed: PDF, XLSX, XLS, CSV, DOCX, DOC.`);
        return;
      }
      const oversized = list.filter((f) => f.size > MAX_BYTES);
      if (oversized.length) {
        setError(`File too large: ${oversized.map((f) => f.name).join(", ")}. Max 50 MB each.`);
        return;
      }
      setFiles((prev) => {
        const next = [
          ...prev,
          ...list.map((f) => ({ file: f, id: `${f.name}-${f.size}-${Date.now()}` })),
        ];
        if (next.length > MAX_FILES) {
          setError(`Maximum ${MAX_FILES} files per upload.`);
          return prev;
        }
        return next;
      });
    },
    [],
  );

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  // ------------------------------------------------------------------
  // Drag & drop
  // ------------------------------------------------------------------
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) validateAndAdd(e.dataTransfer.files);
    },
    [validateAndAdd],
  );

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------
  const handleSubmit = async () => {
    setError(null);
    if (files.length === 0 && !bodyText.trim()) {
      setError("Please upload at least one file or paste some deal text.");
      return;
    }

    setSubmitting(true);
    try {
      await uploadsApi.upload(
        files.map((f) => f.file),
        {
          subject:      subject.trim() || "Manual Upload",
          sender:       sender.trim()  || "Manual Upload",
          sender_email: senderEmail.trim() || undefined,
          body_text:    bodyText.trim()    || undefined,
        },
      );

      toast({
        title:       "Submitted for screening",
        description: "Your deal is in the queue. Check the Screening Queue for progress.",
      });

      // Reset form
      setSubject(""); setSender(""); setSenderEmail(""); setBodyText(""); setFiles([]);
      onClose();
      navigate("/screened");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setSubject(""); setSender(""); setSenderEmail(""); setBodyText(""); setFiles([]); setError(null);
    onClose();
  };

  const canSubmit = !submitting && (files.length > 0 || bodyText.trim().length > 0);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-base font-semibold">Upload Deal for Screening</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Upload PDFs or Excel files, paste email text, or both. The same AI pipeline
            runs as for Gmail emails and the result will appear in your Screening Queue.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Metadata row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="upload-subject" className="text-xs font-medium">
                Subject / Deal Name
              </Label>
              <Input
                id="upload-subject"
                placeholder="e.g. Riverside AL/MC — 80 Units"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-sm h-8"
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upload-sender" className="text-xs font-medium">
                Sender / Broker Name
                <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="upload-sender"
                placeholder="e.g. John Smith"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                className="text-sm h-8"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="upload-sender-email" className="text-xs font-medium">
              Sender Email
              <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="upload-sender-email"
              type="email"
              placeholder="broker@example.com"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              className="text-sm h-8"
              disabled={submitting}
            />
          </div>

          {/* Body text */}
          <div className="space-y-1.5">
            <Label htmlFor="upload-body" className="text-xs font-medium">
              Deal Text / Notes
              <span className="ml-1 text-muted-foreground font-normal">(optional — paste email body or deal summary)</span>
            </Label>
            <textarea
              id="upload-body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              disabled={submitting}
              placeholder="Paste the email body, deal summary, or any notes here…"
              rows={4}
              className={[
                "w-full rounded-md border border-input bg-background px-3 py-2",
                "text-sm placeholder:text-muted-foreground resize-none",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              ].join(" ")}
            />
          </div>

          {/* File drop zone */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Attachments
              <span className="ml-1 text-muted-foreground font-normal">
                (PDF, XLSX, XLS, CSV, DOCX, DOC — max 50 MB each, up to {MAX_FILES} files)
              </span>
            </Label>

            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => !submitting && fileInput.current?.click()}
              className={[
                "relative flex flex-col items-center justify-center gap-2",
                "rounded-lg border-2 border-dashed px-4 py-6 text-center",
                "cursor-pointer transition-colors select-none",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30",
                submitting ? "pointer-events-none opacity-50" : "",
              ].join(" ")}
            >
              <Upload className="h-7 w-7 text-muted-foreground/60" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground/80">
                  Drag & drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">PDF, XLSX, XLS, CSV, DOCX, DOC accepted</p>
              </div>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.docx,.doc"
                className="sr-only"
                onChange={(e) => e.target.files && validateAndAdd(e.target.files)}
                disabled={submitting}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map(({ file, id }) => (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                  >
                    {fileIcon(file.name)}
                    <span className="flex-1 truncate text-xs font-medium text-foreground">
                      {file.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">
                      {formatBytes(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(id); }}
                      disabled={submitting}
                      className="ml-1 rounded p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:pointer-events-none"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-2 pt-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={submitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gap-2 text-xs min-w-[130px]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Upload &amp; Screen
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
