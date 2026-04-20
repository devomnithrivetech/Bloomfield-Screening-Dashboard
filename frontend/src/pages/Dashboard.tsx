import { useState } from "react";
import { Search, Inbox, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmailRow from "@/components/EmailRow";
import EmailDetail from "@/components/EmailDetail";
import { mockEmails, type Email } from "@/data/mockEmails";

const stats = [
  { label: "Deals This Week", value: "8", subtext: "emails received" },
  { label: "Screened", value: "3", subtext: "2 this week", valueColor: "text-success" },
  { label: "Pending Review", value: "2", subtext: "processing now", valueColor: "text-warning" },
  { label: "Avg. Loan Size", value: "$14.2M", subtext: "across active deals" },
];

const Dashboard = () => {
  const [emails, setEmails] = useState<Email[]>(mockEmails);
  const [selectedId, setSelectedId] = useState<string | null>(mockEmails[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmails = emails.filter((email) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      email.sender.toLowerCase().includes(q) ||
      email.subject.toLowerCase().includes(q) ||
      email.snippet.toLowerCase().includes(q)
    );
  });

  const selectedEmail = emails.find((e) => e.id === selectedId) || null;

  const handleSendForProcessing = (id: string) => {
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "Processing" as const } : e))
    );
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
          </div>

          <ScrollArea className="flex-1">
            {filteredEmails.length > 0 ? (
              filteredEmails.map((email) => (
                <EmailRow
                  key={email.id}
                  email={email}
                  isSelected={selectedId === email.id}
                  onClick={() => setSelectedId(email.id)}
                />
              ))
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
          {selectedEmail ? (
            <EmailDetail
              email={selectedEmail}
              onSendForProcessing={handleSendForProcessing}
            />
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
