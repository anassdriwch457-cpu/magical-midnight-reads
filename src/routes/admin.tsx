import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Shield, Coins } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — Nuvia Toon" }] }),
});

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>;

  if (!user) return (
    <div className="container mx-auto px-4 py-20 text-center">
      <p>Please <Link to="/auth" className="text-primary underline">sign in</Link> first.</p>
    </div>
  );

  if (!isAdmin) return (
    <div className="container mx-auto px-4 py-20 max-w-xl text-center">
      <Shield className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
      <h1 className="text-2xl font-bold mb-2">Admin access required</h1>
      <p className="text-muted-foreground mb-6">Your account doesn't have admin privileges yet.</p>
      <div className="rounded-xl border border-border bg-card p-5 text-left text-sm space-y-2">
        <p className="font-semibold">To grant yourself admin access (one-time setup):</p>
        <p className="text-muted-foreground">Open the backend dashboard, go to the SQL editor, and run:</p>
        <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto"><code>{`INSERT INTO public.user_roles (user_id, role)
VALUES ('${user.id}', 'admin')
ON CONFLICT DO NOTHING;`}</code></pre>
        <p className="text-muted-foreground">Then refresh this page.</p>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">Manage series, chapters, and uploads</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <Coins className="h-6 w-6 text-[var(--coin)] mb-3" />
          <h3 className="font-semibold mb-1">Coming next turn</h3>
          <p className="text-sm text-muted-foreground">Series CRUD, chapter management, ZIP bulk upload (browser-side JSZip → Storage), and price editing.</p>
        </div>
      </div>
    </div>
  );
}
