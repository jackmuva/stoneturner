import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { configRegistry } from "@/integrations/config-registry";

type SyncAction = {
  key: "sync" | "updates" | "delete";
  label: string;
  method: "POST" | "DELETE";
  endpoint: (integration: string) => string;
};

const ACTIONS: SyncAction[] = [
  {
    key: "sync",
    label: "Sync",
    method: "POST",
    endpoint: (integration) => `/api/sync/${integration}`,
  },
  {
    key: "updates",
    label: "Sync Updates",
    method: "POST",
    endpoint: (integration) => `/api/sync/updates/${integration}`,
  },
  {
    key: "delete",
    label: "Delete Sync",
    method: "DELETE",
    endpoint: (integration) => `/api/sync/${integration}`,
  },
];

export function TestingPage() {
  const [integration, setIntegration] = useState(configRegistry[0]?.integration ?? "");
  const [pending, setPending] = useState<SyncAction["key"] | null>(null);
  const [response, setResponse] = useState("");

  const runAction = async (action: SyncAction) => {
    if (!integration) return;
    setPending(action.key);
    const url = `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}${action.endpoint(integration)}`;
    const startedAt = new Date().toISOString();
    try {
      const res = await fetch(url, { method: action.method });
      let body: unknown = null;
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      setResponse(
        JSON.stringify(
          {
            request: { method: action.method, url, integration, startedAt },
            response: { status: res.status, ok: res.ok, body },
          },
          null,
          2,
        ),
      );
    } catch (error) {
      setResponse(
        JSON.stringify(
          {
            request: { method: action.method, url, integration, startedAt },
            error: String(error),
          },
          null,
          2,
        ),
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4 font-sans">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-base">Sync Testing</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-2 max-w-sm">
        <Label htmlFor="integration">Integration</Label>
        <Select value={integration} onValueChange={setIntegration}>
          <SelectTrigger id="integration" className="w-full">
            <SelectValue placeholder="Select an integration" />
          </SelectTrigger>
          <SelectContent>
            {configRegistry.map((intConfig) => (
              <SelectItem key={intConfig.integration} value={intConfig.integration}>
                <img src={intConfig.icon} alt={intConfig.integration} height={20} width={20} />
                {intConfig.integration}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ACTIONS.map((action) => (
          <Button
            key={action.key}
            variant={action.key === "delete" ? "destructive" : "secondary"}
            disabled={!integration || pending !== null}
            onClick={() => runAction(action)}
          >
            {pending === action.key ? "Running..." : action.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <Label htmlFor="response">Response</Label>
        <Textarea
          id="response"
          readOnly
          value={response}
          placeholder="Response will appear here..."
          className="flex-1 min-h-[140px] font-mono resize-y"
        />
      </div>
    </div>
  );
}
