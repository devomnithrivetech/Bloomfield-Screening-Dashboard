import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Download, AlertTriangle, CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

// Reusable card section header — uppercase label with a hard bottom rule
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-3.5 border-b border-border bg-muted/20">
      <h2 className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
        {children}
      </h2>
    </div>
  );
}

// Reusable column sub-header inside a split panel
function PanelLabel({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-0.5 h-[18px] rounded-full flex-shrink-0 ${accent}`} />
      <span className="text-xs font-semibold tracking-wider uppercase text-foreground">
        {children}
      </span>
    </div>
  );
}

// Table header cell
function Th({ right, children }: { right?: boolean; children: React.ReactNode }) {
  return (
    <th
      className={`px-6 py-2.5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground whitespace-nowrap
        ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const DealDetail = () => {
  const navigate    = useNavigate();
  const { id }      = useParams<{ id: string }>();
  const [deal, setDeal]   = useState<ApiDealDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let cancelled = false;
    dealsApi.get(id)
      .then((d) => { if (!cancelled) { setDeal(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleDownload = async () => {
    if (!id) return;
    try {
      const { url } = await dealsApi.getScreenerDownloadUrl(id);
      window.open(url, "_blank");
    } catch {
      // silently ignore — button is disabled when no screener exists
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
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
  const highlights   = deal.highlights[0]?.detail ?? "";
  const risks        = deal.risks[0]?.detail ?? "";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-5">

        {/* Back */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        {/* ── Section 1: Deal Header ─────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="px-6 py-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground leading-snug truncate">
                  {deal.property_name}
                </h1>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {[pi.address, pi.city_state, pi.county]
                    .filter(Boolean)
                    .join("  ·  ")}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                {recBadge && (
                  <Badge className={recBadge.className}>{recBadge.label}</Badge>
                )}
                {pi.deal_type && (
                  <Badge className="bg-primary/10 text-primary border border-primary/20 font-semibold text-xs px-3 py-1">
                    {String(pi.deal_type)}
                  </Badge>
                )}
              </div>
            </div>
            {propertyTags.length > 0 && (
              <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center gap-2 flex-wrap">
                {propertyTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs font-medium text-muted-foreground">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Deal Metrics ────────────────────────────────────── */}
        {deal.key_metrics.length > 0 && (
          <Card className="overflow-hidden">
            <SectionHeader>Deal Metrics</SectionHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <Th>Metric</Th>
                    <Th right>Value</Th>
                    <Th right>Per Unit</Th>
                    <Th right>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {deal.key_metrics.map((m: ApiKeyMetric) => (
                    <tr key={m.label} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <span className="text-sm font-medium text-foreground">{m.label}</span>
                        {m.label === "In-place DY" && (
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            TTM NOI / Requested Loan
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold tabular-nums">{m.value}</td>
                      <td className="px-6 py-3 text-right text-muted-foreground tabular-nums">
                        {m.per_unit ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {m.flag === "warn" ? (
                          <span className="inline-flex items-center justify-end gap-1 text-[11px] font-semibold text-warning">
                            <AlertTriangle className="h-3 w-3" /> Flag
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-end gap-1 text-[11px] font-semibold text-success">
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

        {/* ── Section 3b: Financial Summary Highlights ──────────────────── */}
        {deal.financial_summary && deal.financial_summary.length > 0 && (
          <Card className="overflow-hidden">
            <SectionHeader>Financial Summary Highlights</SectionHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <Th>Metric</Th>
                    <Th right>Value</Th>
                    <Th right>Debt Yield</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {deal.financial_summary.map((row) => (
                    <tr key={row.label} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3 text-sm">{row.label}</td>
                      <td className="px-6 py-3 text-right font-semibold tabular-nums">{row.value}</td>
                      <td className="px-6 py-3 text-right text-muted-foreground tabular-nums">
                        {row.dy ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* ── Section 3c: Sources & Uses ────────────────────────────────── */}
        {deal.sources_and_uses && (
          <Card className="overflow-hidden">
            <SectionHeader>Sources &amp; Uses</SectionHeader>
            <div className="grid grid-cols-2 divide-x divide-border">
              {/* Sources */}
              <div>
                <div className="px-6 py-2.5 border-b border-border/60 bg-muted/10">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-foreground">
                    Sources
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <Th>Item</Th>
                      <Th right>Total</Th>
                      <Th right>Per Unit</Th>
                      <Th right>%</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {deal.sources_and_uses.sources.map((row) => (
                      <tr key={row.item} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-2.5 text-sm">{row.item}</td>
                        <td className="px-6 py-2.5 text-right tabular-nums">{row.total}</td>
                        <td className="px-6 py-2.5 text-right text-muted-foreground tabular-nums">{row.per_unit}</td>
                        <td className="px-6 py-2.5 text-right text-muted-foreground tabular-nums">{row.pct}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/20 border-t border-border">
                      <td className="px-6 py-2.5 text-sm font-semibold">Total</td>
                      <td colSpan={3} className="px-6 py-2.5 text-right text-muted-foreground">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Uses */}
              <div>
                <div className="px-6 py-2.5 border-b border-border/60 bg-muted/10">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-foreground">
                    Uses
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <Th>Item</Th>
                      <Th right>Total</Th>
                      <Th right>Per Unit</Th>
                      <Th right>%</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {deal.sources_and_uses.uses.map((row) => (
                      <tr key={row.item} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-2.5 text-sm">{row.item}</td>
                        <td className="px-6 py-2.5 text-right tabular-nums">{row.total}</td>
                        <td className="px-6 py-2.5 text-right text-muted-foreground tabular-nums">{row.per_unit}</td>
                        <td className="px-6 py-2.5 text-right text-muted-foreground tabular-nums">{row.pct}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/20 border-t border-border">
                      <td className="px-6 py-2.5 text-sm font-semibold">Total</td>
                      <td colSpan={3} className="px-6 py-2.5 text-right text-muted-foreground">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        )}

        {/* ── Section 4: Investment Highlights & Risks ───────────────────── */}
        {(highlights || risks) && (
          <Card className="overflow-hidden">
            <SectionHeader>Analysis</SectionHeader>
            <div className={highlights && risks ? "grid grid-cols-2 divide-x divide-border" : ""}>
              {highlights && (
                <div className="p-6">
                  <PanelLabel accent="bg-primary">Investment Highlights</PanelLabel>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {highlights}
                  </p>
                </div>
              )}
              {risks && (
                <div className="p-6">
                  <PanelLabel accent="bg-destructive">
                    Investment Risks &amp; Underwriting Flags
                  </PanelLabel>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {risks}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── Section 4b/4c: Sponsor Overview + Location Summary ─────────── */}
        {(deal.sponsor_overview || deal.location_summary) && (
          <Card className="overflow-hidden">
            <SectionHeader>Sponsor &amp; Market</SectionHeader>
            <div
              className={
                deal.sponsor_overview && deal.location_summary
                  ? "grid grid-cols-2 divide-x divide-border"
                  : ""
              }
            >
              {deal.sponsor_overview && (
                <div className="p-6">
                  <PanelLabel accent="bg-primary">Sponsor Overview</PanelLabel>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {deal.sponsor_overview}
                  </p>
                </div>
              )}
              {deal.location_summary && (
                <div className="p-6">
                  <PanelLabel accent="bg-muted-foreground/40">Location Summary</PanelLabel>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {deal.location_summary}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── Section 5: Actions ─────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <SectionHeader>Actions</SectionHeader>
          <CardContent className="px-6 py-4 flex items-center gap-3">
            <Button
              onClick={handleDownload}
              disabled={!deal.screener_s3_key}
              className="bg-success hover:bg-success/90 text-success-foreground gap-2 press"
            >
              <Download className="h-4 w-4" />
              Download Screener (XLSX)
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default DealDetail;
