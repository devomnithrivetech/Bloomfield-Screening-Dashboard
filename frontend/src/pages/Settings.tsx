import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, X, Plus, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { gmailApi, type GmailStatus } from "@/lib/api";

const SettingsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [disconnectingGmail, setDisconnectingGmail] = useState(false);

  const [keywords, setKeywords] = useState([
    "assisted living", "memory care", "senior housing", "AL/MC", "bridge loan", "origination screener",
  ]);
  const [newKeyword, setNewKeyword] = useState("");
  const [autoTag, setAutoTag] = useState(true);
  const [notifProcessed, setNotifProcessed] = useState(true);
  const [notifProceed, setNotifProceed] = useState(true);
  const [notifDigest, setNotifDigest] = useState(false);
  const [loanParams, setLoanParams] = useState({
    interestRate: "11",
    defaultPointsBloomfield: "2",
    defaultPointsBroker: "1",
    interestReserve: "12",
    defaultCapRate: "9",
  });

  // Load Gmail status on mount
  useEffect(() => {
    gmailApi.getStatus()
      .then((s) => setGmailStatus(s))
      .catch(() => setGmailStatus({ connected: false, email: null, last_synced_at: null }))
      .finally(() => setGmailLoading(false));
  }, []);

  // Handle redirect back from Google OAuth
  useEffect(() => {
    if (searchParams.get("gmail") === "connected") {
      toast({ title: "Gmail connected", description: "Your inbox is now linked." });
      gmailApi.getStatus()
        .then(setGmailStatus)
        .catch(() => {});
      // Clear the query param without re-render loop
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams, toast]);

  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    try {
      const { url } = await gmailApi.getOAuthUrl();
      window.location.href = url;
    } catch {
      toast({ title: "Error", description: "Could not start Gmail authorisation.", variant: "destructive" });
      setConnectingGmail(false);
    }
  };

  const handleDisconnectGmail = async () => {
    setDisconnectingGmail(true);
    try {
      await gmailApi.disconnect();
      setGmailStatus({ connected: false, email: null, last_synced_at: null });
      toast({
        title: "Gmail disconnected",
        description: "Incoming deal emails will no longer sync until you reconnect.",
        variant: "destructive",
      });
    } catch {
      toast({ title: "Error", description: "Failed to disconnect Gmail.", variant: "destructive" });
    } finally {
      setDisconnectingGmail(false);
    }
  };

  const handleReauth = async () => {
    await handleConnectGmail();
  };

  const addKeyword = () => {
    const trimmed = newKeyword.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (kw: string) => setKeywords(keywords.filter((k) => k !== kw));

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast({ title: "Settings saved", description: "Your preferences have been updated." });
    }, 600);
  };

  const handleReplaceTemplate = () => {
    toast({ title: "Upload template", description: "Template replacement is coming in a future release." });
  };

  const formatLastSynced = (ts: string | null) => {
    if (!ts) return null;
    try {
      const d = new Date(ts);
      return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch {
      return ts;
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="max-w-[800px] mx-auto px-6 py-8 space-y-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <div>
          <h1 className="text-2xl font-bold text-primary">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your integrations and AI preferences</p>
        </div>

        {/* Card 1: Gmail Integration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-5 w-5 text-destructive" />
              Gmail Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {gmailLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking connection…
              </div>
            ) : gmailStatus?.connected ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-success" />
                    <span className="text-sm font-medium">Connected</span>
                    {gmailStatus.email && (
                      <span className="text-sm text-muted-foreground">{gmailStatus.email}</span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectGmail}
                    disabled={disconnectingGmail}
                    className="border-destructive text-destructive hover:bg-destructive/5 text-xs press"
                  >
                    {disconnectingGmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Disconnect"}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {gmailStatus.last_synced_at && (
                    <Badge variant="secondary" className="text-[11px] font-normal">
                      Last synced: {formatLastSynced(gmailStatus.last_synced_at)}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[11px] font-normal">Inbox access: Enabled</Badge>
                </div>
                <Button variant="outline" size="sm" onClick={handleReauth} className="text-xs press gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Re-authenticate
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                  <span className="text-sm text-muted-foreground">Not connected</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Connect your Gmail inbox so deal emails are automatically pulled into the dashboard.
                </p>
                <Button
                  onClick={handleConnectGmail}
                  disabled={connectingGmail}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-sm"
                >
                  {connectingGmail ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Connect Gmail
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Email Filter Rules */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Email Filter Rules</CardTitle>
            <CardDescription>
              Keywords that help identify senior housing deal emails in your inbox. Emails matching these terms will be highlighted automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {keywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
                  {kw}
                  <button
                    onClick={() => removeKeyword(kw)}
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a keyword..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                className="max-w-xs"
              />
              <Button size="sm" onClick={addKeyword} className="bg-primary text-primary-foreground gap-1">
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch id="auto-tag" checked={autoTag} onCheckedChange={setAutoTag} />
              <Label htmlFor="auto-tag" className="text-sm">Auto-tag matching emails as Senior Housing</Label>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: AI Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">AI Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Analysis Model</Label>
              <Select defaultValue="claude-sonnet-4">
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-sonnet-4">Claude Sonnet 4</SelectItem>
                  <SelectItem value="claude-opus-4">Claude Opus 4</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Screener Template</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Bloomfield_Screener_Template.xlsx</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleReplaceTemplate} className="text-xs press">Replace</Button>
            </div>

            <div className="border-t border-border pt-4">
              <Label className="text-sm font-semibold">Default Loan Parameters</Label>
              <div className="grid grid-cols-2 gap-4 mt-3">
                {[
                  { key: "interestRate" as const, label: "Interest Rate", suffix: "%" },
                  { key: "defaultPointsBloomfield" as const, label: "Default Points (Bloomfield)", suffix: "%" },
                  { key: "defaultPointsBroker" as const, label: "Default Points (Broker)", suffix: "%" },
                  { key: "interestReserve" as const, label: "Interest Reserve (months)", suffix: "" },
                  { key: "defaultCapRate" as const, label: "Default Cap Rate (underwriting)", suffix: "%" },
                ].map(({ key, label, suffix }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="relative">
                      <Input
                        value={loanParams[key]}
                        onChange={(e) => setLoanParams({ ...loanParams, [key]: e.target.value })}
                        className="pr-8"
                      />
                      {suffix && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          {suffix}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground press gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { id: "notif-processed", label: "Email me when a deal finishes processing", checked: notifProcessed, onChange: setNotifProcessed },
              { id: "notif-proceed", label: "Notify me for PROCEED recommendations", checked: notifProceed, onChange: setNotifProceed },
              { id: "notif-digest", label: "Daily digest of screened deals", checked: notifDigest, onChange: setNotifDigest },
            ].map(({ id, label, checked, onChange }) => (
              <div key={id} className="flex items-center justify-between">
                <Label htmlFor={id} className="text-sm">{label}</Label>
                <Switch id={id} checked={checked} onCheckedChange={onChange} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
