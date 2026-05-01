import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mail, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { gmailApi, type GmailStatus } from "@/lib/api";

const SettingsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [gmailStatus, setGmailStatus]           = useState<GmailStatus | null>(null);
  const [gmailLoading, setGmailLoading]         = useState(true);
  const [connectingGmail, setConnectingGmail]   = useState(false);
  const [disconnectingGmail, setDisconnectingGmail] = useState(false);

  useEffect(() => {
    gmailApi.getStatus()
      .then((s) => setGmailStatus(s))
      .catch(() => setGmailStatus({ connected: false, email: null, last_synced_at: null }))
      .finally(() => setGmailLoading(false));
  }, []);

  useEffect(() => {
    if (searchParams.get("gmail") === "connected") {
      toast({ title: "Gmail connected", description: "Your inbox is now linked." });
      gmailApi.getStatus().then(setGmailStatus).catch(() => {});
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

  const formatLastSynced = (ts: string | null) => {
    if (!ts) return null;
    try {
      return new Date(ts).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
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
          <p className="text-sm text-muted-foreground mt-1">Manage your Gmail integration</p>
        </div>

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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectGmail}
                  disabled={connectingGmail}
                  className="text-xs press gap-1"
                >
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
      </div>
    </div>
  );
};

export default SettingsPage;
