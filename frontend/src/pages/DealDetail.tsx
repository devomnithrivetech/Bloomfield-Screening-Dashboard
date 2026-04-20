import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Check, Download, Mail, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const pipelineStages = [
  { label: "Email Received", timestamp: "Mar 13, 2026  4:28 PM", state: "completed" },
  { label: "Attachments Extracted", timestamp: "Mar 13, 2026  4:28 PM", state: "completed" },
  { label: "AI Analysis", timestamp: "Mar 13, 2026  4:31 PM", state: "completed" },
  { label: "Screener Generated", timestamp: "Mar 13, 2026  4:32 PM", state: "completed" },
  { label: "Ready for Review", timestamp: "Mar 13, 2026  4:32 PM", state: "completed" },
] as { label: string; timestamp: string; state: "completed" | "active" | "pending" }[];

const metrics = [
  { label: "Purchase Price", value: "$23,100,000", flag: "ok" },
  { label: "Requested Loan (LTV)", value: "$18,473,479 (69%)", flag: "ok" },
  { label: "T-12 Revenue", value: "$8,543,337", flag: "ok" },
  { label: "T-12 NOI (EBITDA)", value: "$937,296 (11.0% margin)", flag: "warn" },
  { label: "Year 1 Proforma NOI", value: "$1,499,733 (+60% vs T-12)", flag: "warn" },
  { label: "Current Occupancy", value: "96.3% (108.9 avg residents)", flag: "ok" },
  { label: "Y1 Cap Rate (9% basis)", value: "6.49% → implied $16.7M", flag: "warn" },
  { label: "Y1 DSCR (@ 8%)", value: "1.01x", flag: "warn" },
  { label: "RevPOR (T-12)", value: "$6,540 / resident / month", flag: "ok" },
] as const;

const propertyTags = ["IL / AL / MC", "113 Units", "Built 2019", "135,561 SF"];

const investmentHighlights = "Strong occupancy trajectory (77.3% → 91.6% → 96.3% in 2023–2025) with T-3M ADC of 109.9 residents. Revenue up 33.5% over two years. 100% private-pay drawing from a high-affluence catchment (adult child median income $197K — 72% above national average; 85+ population expected to grow 18.6% within 7 miles over 5 years). Fortress/Paragon have identified $203K in payroll savings, $136K in CapEx reclassification, and a 5% April 2026 rate increase (+$393K), collectively lifting Year 1 NOI 60% above T-12. 47-unit expansion optionality not included in the business plan.";

const investmentRisks = "Operator track record: Paragon Senior Living founded April 2025 (<12 months old), single reference asset. Execution risk elevated during operator transition. Margin compression: T-12 EBITDA declined from $1.05M (2024) to $937K despite $599K revenue growth — payroll and contract labor cost creep. Thin going-in cap rate: 6.49% on Year 1 NOI vs. Bloomfield's 9% underwriting cap rate → Year 1 implied value of $16.7M vs. $18.5M loan (LTV >100% on Bloomfield basis). Value recovery contingent on NOI ramp. CapEx: No PCR/PCA referenced; $1.87M reserve ($16.5K/unit) should be validated.";

const DealDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);

  void id;

  const handleDownload = () => {
    setDownloading(true);
    // TODO: GET /api/deals/:id/screener — stream the .xlsx from Supabase Storage
    setTimeout(() => {
      setDownloading(false);
      toast({
        title: "Screener downloaded",
        description: "Bloomfield_Screener_Providence_Place.xlsx saved to your Downloads folder.",
      });
    }, 900);
  };

  const handleSendEmail = () => {
    setSending(true);
    // TODO: POST /api/deals/:id/send-email
    setTimeout(() => {
      setSending(false);
      setEmailModalOpen(false);
      toast({
        title: "Email sent",
        description: "Screening email delivered to the Investment Committee.",
      });
    }, 900);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-6">
        {/* Back button */}
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
                <h1 className="text-2xl font-bold text-primary">
                  Providence Place at the Collegeville Inn
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  4000 Ridge Pike, Collegeville, PA 19426 &nbsp;·&nbsp; Montgomery County &nbsp;·&nbsp; Philadelphia MSA
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className="bg-success/15 text-success border-0 font-semibold text-xs px-3 py-1">
                  PROCEED TO DILIGENCE
                </Badge>
                <Badge className="bg-primary text-primary-foreground border-0 font-semibold text-xs px-3 py-1">
                  Bridge Acquisition
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              {propertyTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs font-medium">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Processing Pipeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Processing Status</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="flex items-start justify-between relative">
              <div className="absolute top-3 left-3 right-3 h-0.5 bg-border z-0" />
              <div
                className="absolute top-3 left-3 h-0.5 bg-primary z-0"
                style={{
                  width: `calc(${((pipelineStages.filter(s => s.state === "completed").length - 1) / (pipelineStages.length - 1)) * 100}% - 24px)`,
                }}
              />
              {pipelineStages.map((stage) => (
                <div key={stage.label} className="flex flex-col items-center z-10 flex-1">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center",
                      stage.state === "completed" && "bg-primary",
                      stage.state === "active" && "bg-accent animate-pulse",
                      stage.state === "pending" && "bg-muted border-2 border-border"
                    )}
                  >
                    {stage.state === "completed" && (
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-foreground mt-2 text-center">
                    {stage.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center mt-0.5">
                    {stage.timestamp}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Key Metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Deal Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {metrics.map((m) => (
                <div
                  key={m.label}
                  className="border border-border rounded-lg p-4 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                    {m.flag === "warn" ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-warning font-medium">
                        <AlertTriangle className="h-3 w-3" /> Flag
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[10px] text-success font-medium">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </span>
                    )}
                  </div>
                  <span className="text-base font-semibold text-foreground">{m.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Highlights & Risks */}
        <div className="grid grid-cols-2 gap-6">
          <Card className="border-t-[3px] border-t-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Investment Highlights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {investmentHighlights}
              </p>
            </CardContent>
          </Card>
          <Card className="border-t-[3px] border-t-destructive">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Investment Risks & Underwriting Flags</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {investmentRisks}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Section 5: Actions */}
        <Card>
          <CardContent className="p-6 flex items-center gap-3">
            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="bg-success hover:bg-success/90 text-success-foreground gap-2 press"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? "Preparing..." : "Download Screener (XLSX)"}
            </Button>
            <Button
              variant="outline"
              className="border-primary text-primary hover:bg-primary/5 gap-2 press"
              onClick={() => setEmailModalOpen(true)}
            >
              <Mail className="h-4 w-4" />
              Preview Draft Email
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Email Preview Modal */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Draft Screening Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-1 border-b border-border pb-4">
              <p><span className="text-muted-foreground">Subject:</span> <span className="font-medium">Fwd: Origination Screener — Providence Place at Collegeville Inn (PA) | Bridge | $18.5M</span></p>
              <p><span className="text-muted-foreground">To:</span> Investment Committee</p>
              <p><span className="text-muted-foreground">From:</span> Shana Weiss &lt;sweiss@bloomfieldcapital.com&gt;</p>
            </div>

            <p>Team,</p>
            <p>Please find below the screening summary for <strong>Providence Place at the Collegeville Inn</strong>, a 113-unit IL/AL/MC senior living community in Collegeville, PA. The sponsor is seeking $18.5M in bridge financing for acquisition.</p>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ["Property", "Providence Place at the Collegeville Inn"],
                    ["Location", "Collegeville, PA (Philadelphia MSA)"],
                    ["Units", "113 (54 IL / 38 AL / 21 MC)"],
                    ["Loan Request", "$18,473,479 (69% LTV)"],
                    ["Purchase Price", "$23,100,000"],
                    ["Occupancy", "96.3%"],
                    ["T-12 NOI", "$937,296"],
                    ["Y1 Proforma NOI", "$1,499,733"],
                    ["Y1 DSCR (@ 8%)", "1.01x"],
                  ].map(([label, value], i) => (
                    <tr key={label} className={i % 2 === 0 ? "bg-muted/50" : ""}>
                      <td className="px-3 py-2 font-medium text-muted-foreground w-[180px]">{label}</td>
                      <td className="px-3 py-2">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <p className="font-semibold mb-1">Highlights</p>
              <p className="text-muted-foreground text-[13px] leading-relaxed">{investmentHighlights}</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Risks & Flags</p>
              <p className="text-muted-foreground text-[13px] leading-relaxed">{investmentRisks}</p>
            </div>

            <p>Recommendation: <strong className="text-success">Proceed to Diligence</strong></p>
            <p className="text-muted-foreground">— Shana</p>
          </div>
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
    </div>
  );
};

export default DealDetail;
