import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Coins, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { SparkleBurst } from "@/components/sparkle-burst";
import { api } from "@/lib/api";

const SearchSchema = z.object({
  session_id: z.string().optional(),
});

export const Route = createFileRoute("/success")({
  validateSearch: (search) => SearchSchema.parse(search),
  component: SuccessPage,
  head: () => ({
    meta: [
      { title: "Payment Successful — Nuvia Toon" },
      { name: "description", content: "Your coins are being credited to your wallet." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Status = "verifying" | "paid" | "pending" | "error";

function SuccessPage() {
  const { session_id } = Route.useSearch();
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const ranRef = useRef(false);

  const [status, setStatus] = useState<Status>("verifying");
  const [credited, setCredited] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sparkle, setSparkle] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (ranRef.current && retryCount === 0) return;
    if (!session_id) {
      setStatus("error");
      setErrorMsg("Missing session id");
      return;
    }
    ranRef.current = true;

    const verifyPayment = async (attempt = 0) => {
      try {
        setStatus("verifying");
        setErrorMsg(null);

        // This will call your Laravel endpoint to verify the Stripe session
        const res = await api.post<{
          paid: boolean;
          credited: number;
          balance?: number;
          alreadyCredited?: boolean;
        }>("/verify-checkout", { sessionId: session_id });

        if (!res.paid) {
          // If not paid yet, we might want to retry automatically or wait
          if (attempt < 2) {
            setTimeout(() => verifyPayment(attempt + 1), 3000);
            return;
          }
          setStatus("pending");
          return;
        }

        setStatus("paid");
        setCredited(res.credited);
        setBalance(res.balance ?? null);
        await refreshUser();
        if (!res.alreadyCredited) {
          setSparkle(true);
          toast.success(`+${res.credited} coins added!`);
        }
      } catch (e) {
        console.error("Payment verification failed", e);
        
        // Handle specific error types
        let message = "Verification failed. Please check your internet connection and try again.";
        
        if (e instanceof Error) {
          // Check for network errors or timeouts (Axios specific if possible)
          if (e.message.includes("timeout") || e.message.includes("Network Error")) {
            message = "Connection timeout. Your payment might still be processing. Please refresh or try again.";
          } else {
            message = e.message;
          }
        }

        setStatus("error");
        setErrorMsg(message);
        
        // If it was a network error, maybe allow a manual retry button
        toast.error(message);
      }
    };

    verifyPayment();
  }, [session_id, refreshUser, retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-xl">
      {sparkle && <SparkleBurst onDone={() => setSparkle(false)} />}
      <div className="rounded-2xl glass-card p-8 text-center shadow-elev animate-scale-in">
        {status === "verifying" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 text-primary animate-spin mb-4" />
            <h1 className="text-2xl font-bold mb-2">Confirming your payment…</h1>
            <p className="text-muted-foreground">
              Please don't close this page. We're verifying with Stripe.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-destructive mb-6">{errorMsg}</p>
            <div className="flex flex-col gap-3">
              <Button onClick={handleRetry} variant="default">
                Try Again
              </Button>
              <Button asChild variant="outline">
                <Link to="/topup">Back to Top Up</Link>
              </Button>
            </div>
          </>
        )}

        {status === "pending" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 text-amber-500 animate-spin mb-4" />
            <h1 className="text-2xl font-bold mb-2">Payment Pending</h1>
            <p className="text-muted-foreground mb-6">
              Stripe is still processing your payment. This can take a moment.
            </p>
            <Button onClick={handleRetry} variant="default">
              Check Again
            </Button>
          </>
        )}

        {status === "paid" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h1 className="text-3xl font-bold mb-2">Payment successful</h1>
            {credited !== null && (
              <div className="inline-flex items-center gap-2 mt-2 rounded-full border border-border bg-background px-4 py-2">
                <Coins className="h-4 w-4 text-[var(--coin)]" />
                <span className="font-bold tabular-nums">+{credited}</span>
                <span className="text-muted-foreground text-sm">coins added</span>
              </div>
            )}
            {balance !== null && (
              <p className="text-sm text-muted-foreground mt-3">
                New balance: <span className="font-semibold tabular-nums">{balance}</span> coins
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
              <Button asChild className="bg-brand text-primary-foreground border-0">
                <Link to="/browse">Browse series</Link>
              </Button>
              <Button asChild variant="outline" onClick={() => navigate({ to: "/topup" })}>
                <Link to="/topup">Buy more coins</Link>
              </Button>
            </div>
          </>
        )}

        {status === "pending" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 text-yellow-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Payment pending</h1>
            <p className="text-muted-foreground">
              Stripe hasn't confirmed your payment yet. Refresh this page in a moment, or check back
              later — coins will be credited automatically once payment clears.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => window.location.reload()}>Refresh</Button>
              <Button asChild variant="outline">
                <Link to="/topup">Back to top up</Link>
              </Button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive mb-4" />
            <h1 className="text-2xl font-bold mb-2">Couldn't verify payment</h1>
            <p className="text-muted-foreground">{errorMsg ?? "Unknown error"}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link to="/topup">Back to top up</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
