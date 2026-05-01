import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign In — Nuvia Toon" }] }),
});

function AuthPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handle = async (mode: "signin" | "signup") => {
    if (!email || password.length < 6) { toast.error("Email + 6+ char password required"); return; }
    setLoading(true);
    const { error } = mode === "signin"
      ? await signIn(email, password)
      : await signUp(email, password, name || email.split("@")[0]);
    setLoading(false);
    if (error) toast.error(error);
    else if (mode === "signup") toast.success("Check your email to confirm your account!");
    else { toast.success("Welcome back!"); navigate({ to: "/" }); }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(error);
      setGoogleLoading(false);
    }
    // On success, browser is redirected to Google.
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
        <div className="text-center mb-6">
          <Sparkles className="mx-auto h-8 w-8 text-primary mb-2 animate-pulse" />
          <h1 className="text-2xl font-bold text-brand">Welcome to Nuvia Toon</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to unlock magical chapters</p>
        </div>
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="space-y-4 mt-6">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button className="w-full bg-brand text-primary-foreground border-0" disabled={loading} onClick={() => handle("signin")}>{loading ? "..." : "Sign In"}</Button>
          </TabsContent>
          <TabsContent value="signup" className="space-y-4 mt-6">
            <div className="space-y-2"><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" /></div>
            <Button className="w-full bg-brand text-primary-foreground border-0" disabled={loading} onClick={() => handle("signup")}>{loading ? "..." : "Create account"}</Button>
          </TabsContent>
        </Tabs>
        <p className="text-xs text-center text-muted-foreground mt-6"><Link to="/" className="hover:text-primary">← Back to home</Link></p>
      </div>
    </div>
  );
}
