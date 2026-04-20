import { AlertTriangle, ExternalLink } from "lucide-react";
import { BloomfieldLogo } from "@/components/BloomfieldLogo";

const SetupRequired = () => (
  <div className="min-h-screen flex items-center justify-center bg-background p-6">
    <div className="max-w-xl w-full">
      <div className="mb-8">
        <BloomfieldLogo />
      </div>

      <div className="rounded-lg border border-warning/40 bg-warning/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-warning flex-shrink-0 mt-0.5" />
          <div className="space-y-4">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Supabase not configured</h1>
              <p className="text-sm text-muted-foreground mt-1">
                The dashboard can't start until Supabase credentials are provided.
              </p>
            </div>

            <ol className="text-sm space-y-3 list-decimal list-inside text-foreground">
              <li>
                Open{" "}
                <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                  frontend/.env.local
                </code>{" "}
                and replace the placeholders with your real values:
                <pre className="mt-2 p-3 rounded bg-muted text-xs font-mono overflow-x-auto">
{`VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}
                </pre>
              </li>
              <li>
                Grab both values from your Supabase dashboard under{" "}
                <strong>Project Settings → API</strong>.
              </li>
              <li>
                Stop the dev server (Ctrl+C) and run{" "}
                <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                  npm run dev
                </code>{" "}
                again. Vite only reads env files at startup.
              </li>
            </ol>

            <div className="pt-2 border-t border-warning/20">
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                Open Supabase dashboard
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <p className="text-xs text-muted-foreground pt-2">
              Full walkthrough in <code className="font-mono">SUPABASE_SETUP.md</code> at the repo root.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default SetupRequired;
