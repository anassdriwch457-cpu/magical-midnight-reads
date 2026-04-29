import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Nuvia Toon" },
      { name: "description", content: "How Nuvia Toon collects, uses, and protects your data." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 pt-28 pb-20 prose prose-invert">
      <h1 className="text-4xl font-extrabold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground text-sm">Last updated: {new Date().toLocaleDateString()}</p>

      <h2 className="mt-8 text-xl font-bold">Data we collect</h2>
      <p className="text-muted-foreground">
        We collect your email address, display name, coin balance, and reading history to operate the service.
      </p>

      <h2 className="mt-6 text-xl font-bold">How we use it</h2>
      <p className="text-muted-foreground">
        Your data is used to authenticate you, deliver chapters you've unlocked, and improve recommendations.
      </p>

      <h2 className="mt-6 text-xl font-bold">Storage & security</h2>
      <p className="text-muted-foreground">
        Data is stored securely in our managed backend with row-level access controls. Payments are processed by Stripe — we never see your full card details.
      </p>

      <h2 className="mt-6 text-xl font-bold">Your rights</h2>
      <p className="text-muted-foreground">
        You can request export or deletion of your account data at any time by contacting support.
      </p>

      <h2 className="mt-6 text-xl font-bold">Cookies</h2>
      <p className="text-muted-foreground">
        We use essential cookies for authentication and session management. We do not use advertising cookies.
      </p>
    </div>
  );
}
