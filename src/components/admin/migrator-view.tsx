import { Button } from "@/components/ui/button";
import { AlertTriangle, Globe } from "lucide-react";

export function MigratorView() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-xl bg-card/50">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Globe className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-3">Content Migrator</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        The content migrator and scraping engine have been moved to the Laravel backend 
        for improved performance and stability.
      </p>
      <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-sm mb-8">
        <AlertTriangle className="h-4 w-4" />
        <span>Please use the Laravel admin panel to manage content imports.</span>
      </div>
      <Button disabled variant="outline">
        Launch Laravel Migrator
      </Button>
    </div>
  );
}
