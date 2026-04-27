import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Paperclip, Table2, Download, CheckCircle2, Loader2, ArrowRight, FileText } from "lucide-react";
import { emailsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { Email } from "@/data/mockEmails";
import { cn } from "@/lib/utils";

interface EmailDetailProps {
  email: Email;
  onSendForProcessing: (id: string) => void;
}

const generateSummary = (email: Email): string => {
  const senderName = email.sender.split(",")[0];
  const attachmentInfo = email.attachments.length > 0
    ? `\n\nAttachments: ${email.attachments.map(a => a.filename).join(", ")}`
    : "\n\nNo attachments included.";
  
  // Extract key details from the body
  const lines = email.body.split("\n").filter(l => l.trim());
  const bulletPoints = lines.filter(l => l.trim().startsWith("•")).slice(0, 4).join("\n");
  
  return `${senderName} is presenting a financing opportunity regarding "${email.subject.split("—")[1]?.trim() || email.subject}".\n\n${bulletPoints ? `Key metrics:\n${bulletPoints}` : lines.slice(1, 3).join(" ")}${attachmentInfo}`;
};

const EmailDetail = ({ email, onSendForProcessing }: EmailDetailProps) => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [summarizeState, setSummarizeState] = useState<"idle" | "loading" | "ready">("idle");
  const [showSummary, setShowSummary] = useState(false);

  // Reset summarize state when email changes
  useEffect(() => {
    setSummarizeState("idle");
    setShowSummary(false);
  }, [email.id]);

  const handleSummarize = () => {
    if (summarizeState === "idle") {
      setSummarizeState("loading");
      setTimeout(() => setSummarizeState("ready"), 2000);
    } else if (summarizeState === "ready") {
      setShowSummary(true);
    }
  };

  return (
    <>
    <div className="flex flex-col h-full">
      {/* Section 1: Header */}
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

      {/* Section 2: Body + Attachments */}
      <ScrollArea className="flex-1 px-6 py-5">
        <div className="whitespace-pre-line text-sm text-foreground leading-relaxed">
          {email.body}
        </div>

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
                    att.type === "pdf" && "border-l-[3px] border-l-destructive"
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

      {/* Section 3: Actions Bar */}
      <div className="border-t border-border px-6 py-4 bg-card">
        {email.status === "Unprocessed" && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSummarize}
              disabled={summarizeState === "loading"}
              className="gap-2"
            >
              {summarizeState === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Summarising...
                </>
              ) : summarizeState === "ready" ? (
                <>
                  <FileText className="h-4 w-4" />
                  Summary
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Summarise
                </>
              )}
            </Button>
            <Button
              onClick={() => setShowConfirm(true)}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Send for Processing
            </Button>
          </div>
        )}

        {email.status === "Processing" && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSummarize}
              disabled={summarizeState === "loading"}
              className="gap-2"
            >
              {summarizeState === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Summarising...
                </>
              ) : summarizeState === "ready" ? (
                <>
                  <FileText className="h-4 w-4" />
                  Summary
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Summarise
                </>
              )}
            </Button>
            <Button disabled variant="outline" size="sm" className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </Button>
            <Button
              size="sm"
              onClick={() => navigate(`/deal/${email.id}`)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 ml-auto"
            >
              More Details
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {email.status === "Processed" && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSummarize}
              disabled={summarizeState === "loading"}
              className="gap-2"
            >
              {summarizeState === "loading" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Summarising...
                </>
              ) : summarizeState === "ready" ? (
                <>
                  <FileText className="h-4 w-4" />
                  Summary
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Summarise
                </>
              )}
            </Button>
            <Badge className="bg-success/15 text-success border-0 gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Processed
            </Badge>
            <Button
              size="sm"
              onClick={() => navigate(`/deal/${email.id}`)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1 ml-auto"
            >
              Screening Results
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>

      {/* Confirm Processing Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send for Processing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send the email and its {email.attachments.length} attachment{email.attachments.length !== 1 ? "s" : ""} to the AI pipeline for analysis. Deal data will be extracted and a screener will be generated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onSendForProcessing(email.id)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Confirm & Process
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Summary Dialog */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Email Summary</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              AI-generated summary of this email
            </DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-line text-sm text-foreground leading-relaxed mt-2">
            {generateSummary(email)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailDetail;
