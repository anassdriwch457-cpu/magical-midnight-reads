import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — Nuvia Toon" },
      { name: "description", content: "The terms of service governing your use of Nuvia Toon." },
    ],
  }),
});

function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 pt-28 pb-20 prose prose-invert">
      <h1 className="text-4xl font-extrabold mb-2">Terms of Service</h1>
      <p className="text-muted-foreground text-sm">Last updated: {new Date().toLocaleDateString()}</p>

      <h2 className="mt-8 text-xl font-bold">1. Acceptance</h2>
      <p className="text-muted-foreground">
        By using Nuvia Toon you agree to these Terms. If you do not agree, please do not use the service.
      </p>

      <h2 className="mt-6 text-xl font-bold">2. Accounts</h2>
      <p className="text-muted-foreground">
        You are responsible for safeguarding your account credentials and for all activity under your account.
      </p>

      <h2 className="mt-6 text-xl font-bold">3. Coins & Purchases</h2>
      <p className="text-muted-foreground">
        Coins are a non-refundable virtual currency used to unlock chapters. Purchases are final once processed.
      </p>

      <h2 className="mt-6 text-xl font-bold">4. Content</h2>
      <p className="text-muted-foreground">
        All content is owned by its respective creators or licensors. You may not redistribute or scrape the content.
      </p>

      <h2 className="mt-6 text-xl font-bold">5. Termination</h2>
      <p className="text-muted-foreground">
        We may suspend or terminate accounts that violate these Terms. You may delete your account at any time.
      </p>
    </div>
  );
}
