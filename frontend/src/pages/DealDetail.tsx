import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Download, Mail, AlertTriangle,
  CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { dealsApi, type ApiDealDetail, type ApiKeyMetric } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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
  const pi           = deal.property_info ?? {};
  const propertyTags = formatPropertyTags(deal);
  const recBadge     = REC_BADGE[deal.recommendation ?? ""] ?? null;

  const highlights = deal.highlights[0]?.detail ?? "";
  const risks      = deal.risks[0]?.detail ?? "";

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

        {/* Section 3: Deal Metrics — table layout */}
        {deal.key_metrics.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Deal Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs">Metric</th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground text-xs">Value</th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground text-xs">Per Unit</th>
                    <th className="text-right py-2 font-medium text-muted-foreground text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deal.key_metrics.map((m: ApiKeyMetric) => (
                    <tr key={m.label} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4">
                        <span className="text-sm font-medium text-foreground">{m.label}</span>
                        {m.label === "In-place DY" && (
                          <span className="block text-[11px] text-muted-foreground leading-tight mt-0.5">
                            TTM NOI / Requested Loan
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-semibold">{m.value}</td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">{m.per_unit ?? "—"}</td>
                      <td className="py-2.5 text-right">
                        {m.flag === "warn" ? (
                          <span className="flex items-center justify-end gap-0.5 text-[11px] text-warning font-medium">
                            <AlertTriangle className="h-3 w-3" /> Flag
                          </span>
                        ) : (
                          <span className="flex items-center justify-end gap-0.5 text-[11px] text-success font-medium">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Section 3b: Financial Summary Highlights */}
        {deal.financial_summary && deal.financial_summary.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Financial Summary Highlights</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs">Metric</th>
                    <th className="text-right py-2 pr-4 font-medium text-muted-foreground text-xs">Value</th>
                    <th className="text-right py-2 font-medium text-muted-foreground text-xs">DY</th>
                  </tr>
                </thead>
                <tbody>
                  {deal.financial_summary.map((row) => (
                    <tr key={row.label} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4 text-sm">{row.label}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold">{row.value}</td>
                      <td className="py-2.5 text-right text-muted-foreground">{row.dy ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Section 3c: Sources & Uses */}
        {deal.sources_and_uses && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sources &amp; Uses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                {/* Sources */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Sources</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground text-xs">Item</th>
                        <th className="text-right py-1.5 pr-2 font-medium text-muted-foreground text-xs">Total</th>
                        <th className="text-right py-1.5 pr-2 font-medium text-muted-foreground text-xs">Per Unit</th>
                        <th className="text-right py-1.5 font-medium text-muted-foreground text-xs">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deal.sources_and_uses.sources.map((row) => (
                        <tr key={row.item} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-2 text-sm">{row.item}</td>
                          <td className="py-2 pr-2 text-right">{row.total}</td>
                          <td className="py-2 pr-2 text-right text-muted-foreground">{row.per_unit}</td>
                          <td className="py-2 text-right text-muted-foreground">{row.pct}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border">
                        <td className="py-2 pr-2 text-sm font-semibold">Total</td>
                        <td colSpan={3} className="py-2 text-right text-muted-foreground">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* Uses */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Uses</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground text-xs">Item</th>
                        <th className="text-right py-1.5 pr-2 font-medium text-muted-foreground text-xs">Total</th>
                        <th className="text-right py-1.5 pr-2 font-medium text-muted-foreground text-xs">Per Unit</th>
                        <th className="text-right py-1.5 font-medium text-muted-foreground text-xs">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deal.sources_and_uses.uses.map((row) => (
                        <tr key={row.item} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-2 text-sm">{row.item}</td>
                          <td className="py-2 pr-2 text-right">{row.total}</td>
                          <td className="py-2 pr-2 text-right text-muted-foreground">{row.per_unit}</td>
                          <td className="py-2 text-right text-muted-foreground">{row.pct}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border">
                        <td className="py-2 pr-2 text-sm font-semibold">Total</td>
                        <td colSpan={3} className="py-2 text-right text-muted-foreground">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
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

        {/* Section 4b/4c: Sponsor Overview + Location Summary */}
        {(deal.sponsor_overview || deal.location_summary) && (
          <div className="grid grid-cols-2 gap-6">
            {deal.sponsor_overview && (
              <Card className="border-t-[3px] border-t-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sponsor Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {deal.sponsor_overview}
                  </p>
                </CardContent>
              </Card>
            )}
            {deal.location_summary && (
              <Card className="border-t-[3px] border-t-muted-foreground/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Location Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {deal.location_summary}
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
