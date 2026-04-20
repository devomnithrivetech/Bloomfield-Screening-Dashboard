import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Landing page for Supabase email-confirmation links. The session is picked up
 * from the URL by `detectSessionInUrl` in the client config; we just wait for
 * it to settle and then redirect.
 */
const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      navigate(data.session ? "/" : "/auth/login", { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Signing you in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
