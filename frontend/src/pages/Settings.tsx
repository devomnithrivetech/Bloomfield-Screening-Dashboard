import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, X, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
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
    // TODO: PUT /api/settings/screening + /api/settings/filters + /api/settings/notifications
    setTimeout(() => {
      setSaving(false);
      toast({ title: "Settings saved", description: "Your preferences have been updated." });
    }, 600);
  };

  const handleDisconnectGmail = () => {
    toast({
      title: "Gmail disconnected",
      description: "Incoming deal emails will no longer sync until you reconnect.",
      variant: "destructive",
    });
  };

  const handleReauth = () => {
    // TODO: GET /api/auth/google/start and redirect to consent screen
    toast({
      title: "Redirecting to Google...",
      description: "You'll be asked to re-grant Gmail inbox access.",
    });
  };

  const handleReplaceTemplate = () => {
    toast({
      title: "Upload template",
      description: "Template replacement is coming in a future release.",
    });
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-success" />
                <span className="text-sm font-medium">Connected</span>
                <span className="text-sm text-muted-foreground">sweiss@bloomfieldcapital.com</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectGmail}
                className="border-destructive text-destructive hover:bg-destructive/5 text-xs press"
              >
                Disconnect
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[11px] font-normal">Last synced: 2 minutes ago</Badge>
              <Badge variant="secondary" className="text-[11px] font-normal">Inbox access: Enabled</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={handleReauth} className="text-xs press">
              Re-authenticate
            </Button>
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
