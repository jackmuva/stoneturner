import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DatabaseZapIcon, HardDriveDownloadIcon } from "lucide-react";
import type { IntegrationConfig } from "@/core/models/models";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import type { IntegrationCredential } from "@/core/db/schema/schema";

export const IntegrationDialog = ({
  intConfig,
  integrationsMutate,
  defaultOpen,
  open: controlledOpen,
  onOpenChange,
}: {
  intConfig: IntegrationConfig,
  integrationsMutate?: () => void,
  defaultOpen?: boolean,
  open?: boolean,
  onOpenChange?: (open: boolean) => void,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };
  const [intInputs, setIntInputs] = useState<Record<string, string>>({});
  const allFieldsFilled = intConfig.inputs?.every(
    (input) => (intInputs[input.input]?.trim().length ?? 0) > 0
  );

  const upsertIntegrationCreds = async (intConfig: IntegrationConfig) => {
    if (!allFieldsFilled) return;
    if (intConfig.integrationType === "BASIC_TOKEN") {
      const integrationConfig: IntegrationCredential = {
        id: crypto.randomUUID(),
        integration: intConfig.integration,
        integrationType: intConfig.integrationType,
        apiKey: intInputs["apiKey"] ?? null,
        accessToken: intInputs['accessToken'] ?? null,
        refreshToken: intInputs['refreshToken'] ?? null,
        accessKey: intInputs["accessKey"] ?? null,
        secretKey: intInputs["secretKey"] ?? null,
        baseUrl: intInputs["baseUrl"] ?? null,
        tokenExpiration: intInputs["tokenExpiration"] ?? null,
      }

      await fetch(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/integrations`, {
        method: "POST",
        body: JSON.stringify(integrationConfig),
        credentials: "include",
      });
      if (integrationsMutate) integrationsMutate();
      toast("Credential Saved", { position: "top-center" })
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant={"default"} className="flex gap-1 items-center w-full">
            <DatabaseZapIcon size={16} />
            <div>Connect</div>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="font-sans">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Connect your {intConfig.integration}
          </DialogTitle>
          <DialogDescription>
            {intConfig.integrationType === "BASIC_TOKEN" ?
              (
                <span>
                  Connect your data integration via a basic token found in your {intConfig.integration} settings.
                  Visit <a className="text-indigo-700 underline" href={intConfig.docs} target="_blank">{intConfig.integration} docs</a> for further instruction.
                </span>
              )
              : (
                <span>
                  {!new URL(intConfig.oauthAuthorizationUrl!).searchParams.get("client_id")
                    ? "OAuth App Credentials needed"
                    : `${intConfig.installUrl ? "First install your app to your integration before connecting your " : "Connect your "}${intConfig.integration} via oauth`}
                </span>
              )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {intConfig.inputs?.map((input) => {
            return (
              <Input key={input.input + intConfig.integration} placeholder={input.label} onChange={(e) => {
                e.preventDefault();
                setIntInputs((prev) => ({
                  ...prev, [input.input]: e.target.value
                }))
              }} />
            );
          })}
        </div>
        <DialogFooter>
          <div className="w-full flex flex-col gap-2">
            {intConfig.installUrl &&
              <Button variant={"default"} className="flex items-center gap-2 w-full"
                onClick={async () => {
                  window.location.href = intConfig.installUrl!;
                }}>
                <HardDriveDownloadIcon size={16} />
                <div>Install</div>
              </Button>

            }
            <Button variant={"default"} className="flex items-center gap-2 w-full" disabled={(!allFieldsFilled && intConfig.integrationType !== "OAUTH")
              || (intConfig.integrationType === "OAUTH" && !new URL(intConfig.oauthAuthorizationUrl!).searchParams.get("client_id"))}
              onClick={async () => {
                if (intConfig.integrationType !== "OAUTH") {
                  upsertIntegrationCreds(intConfig);
                  return;
                } else {
                  window.location.href = intConfig.oauthAuthorizationUrl!;
                }
              }}>
              <DatabaseZapIcon size={16} />
              <div>Connect</div>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
