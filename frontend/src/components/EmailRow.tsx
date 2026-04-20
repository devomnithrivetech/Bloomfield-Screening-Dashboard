import { Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Email } from "@/data/mockEmails";
import { cn } from "@/lib/utils";

interface EmailRowProps {
  email: Email;
  isSelected: boolean;
  onClick: () => void;
}

const statusStyles = {
  Unprocessed: "bg-muted text-muted-foreground",
  Processing: "bg-warning/15 text-warning",
  Processed: "bg-success/15 text-success",
};

const attachmentStyles = {
  excel: "bg-success/10 text-success",
  pdf: "bg-destructive/10 text-destructive",
  other: "bg-muted text-muted-foreground",
};

const EmailRow = ({ email, isSelected, onClick }: EmailRowProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3.5 border-b border-secondary transition-all duration-150",
        "hover:bg-accent/5 hover:pl-[17px]",
        "focus-visible:outline-none focus-visible:bg-accent/5 focus-visible:pl-[17px]",
        isSelected && "border-l-[3px] border-l-accent bg-accent/5 pl-[17px]"
      )}
    >
      {/* Line 1: Sender + Date */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-foreground truncate">{email.sender}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{email.date}</span>
      </div>

      {/* Line 2: Subject + Status */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="text-[13px] font-medium text-foreground line-clamp-2">{email.subject}</span>
        <Badge
          className={cn(
            "text-[10px] px-2 py-0.5 font-semibold flex-shrink-0 border-0",
            statusStyles[email.status]
          )}
        >
          {email.status === "Processing" && (
            <span className="mr-1 inline-flex">
              <span className="animate-spin h-2.5 w-2.5 border-[1.5px] border-current border-t-transparent rounded-full" />
            </span>
          )}
          {email.status}
        </Badge>
      </div>

      {/* Line 3: Snippet */}
      <p className="text-xs text-muted-foreground line-clamp-3 mt-1">{email.snippet}</p>

      {/* Line 4: Attachments */}
      {email.attachments.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {email.attachments.map((att) => (
            <span
              key={att.filename}
              className={cn(
                "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium",
                attachmentStyles[att.type]
              )}
            >
              <Paperclip className="h-3 w-3" />
              {att.filename}
            </span>
          ))}
        </div>
      )}
    </button>
  );
};

export default EmailRow;
