import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../ui/dialog";
import { DatabaseZapIcon } from "lucide-react";
import { Integration, IntegrationConfig } from "@/models/integration-models";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

export const IntegrationDialog = ({
  intConfig,
  userId,
  integrationsMutate,
  syncTaskMutate,
}: {
  intConfig: IntegrationConfig,
  userId: string,
  integrationsMutate: () => void,
  syncTaskMutate: () => void,
}) => {
  const [open, setOpen] = useState(false);
  const [intInputs, setIntInputs] = useState<Record<string, string>>({});
  const allFieldsFilled = intConfig.inputs.every(
    (input) => intInputs[input.input]?.trim().length > 0
  );

  const upsertIntegrationCreds = async (intConfig: IntegrationConfig) => {
    if (!allFieldsFilled) return;
    if (intConfig.integrationType === "BASIC_TOKEN") {
      const integrationConfig: Integration = {
        id: crypto.randomUUID(),
        integration: intConfig.integration,
        integrationType: intConfig.integrationType,
        apiKey: null, accessToken: null, refreshToken: null,
        accessKey: intInputs["accessKey"],
        secretKey: intInputs["secretKey"],
        baseUrl: intInputs["baseUrl"],
        userId: userId,
      }
      await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/api/integrations`, {
        method: "POST",
        body: JSON.stringify(integrationConfig),
        credentials: "include",
      });
      integrationsMutate();
      toast("Credential Saved", { position: "top-center" })
      setOpen(false);
      setTimeout(() => {
        syncTaskMutate();
      }, 5000);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={"default"} className="flex gap-1 items-center w-full">
          <DatabaseZapIcon size={16} />
          <div>Connect</div>
        </Button>
      </DialogTrigger>
      <DialogContent className="font-mono">
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
              : <></>}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {intConfig.inputs.map((input) => {
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
          <Button variant={"default"} className="flex items-center gap-2 w-full" disabled={!allFieldsFilled}
            onClick={async () => {
              upsertIntegrationCreds(intConfig);
            }}>
            <DatabaseZapIcon size={16} />
            <div>Connect</div>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
