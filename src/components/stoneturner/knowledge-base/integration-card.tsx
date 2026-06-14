import type { IntegrationConfig } from "@/core/models/models";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { IntegrationDialog } from "./integration-dialog";
import { BoltIcon } from "lucide-react";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import { useNavigate } from "react-router-dom";

//TODO:Button for incremental syncs
export const IntegrationCard = ({
  intConfig,
  integrations,
  syncing,
  syncTaskMutate,
  integrationsMutate,
}: {
  intConfig: IntegrationConfig,
  integrations: IntegrationCredential[],
  syncing: boolean,
  syncTaskMutate: () => void,
  integrationsMutate: () => void,
}) => {
  let navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2 text-lg">
            <img src={intConfig.icon} alt={intConfig.icon} height={30} width={30} />
            <label>
              {intConfig.integration} Data
            </label>
          </div>
          {integrations.filter((connectedInt: IntegrationCredential) => connectedInt.integration === intConfig.integration).length > 0 ? (
            !syncing ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div>
                  Connected
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <div>
                  Syncing
                </div>
              </div>
            )
          ) : (<></>)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {integrations.filter((connectedInt: IntegrationCredential) => connectedInt.integration === intConfig.integration).length > 0 ? (
          <div className="flex flex-col gap-2 w-full">
            <Button variant={"default"} className="w-full"
              onClick={async () => {
                // router.push(`/app/knowledge/${intConfig.integration.toLowerCase()} `)
                await fetch(`${process.env.BACKEND_BASE_URL}/api/sync/gong`, {
                  method: "POST",
                  credentials: "include",
                });
              }}>
              <BoltIcon size={16} />
              Configure
            </Button>
          </div>
        ) : (
          <IntegrationDialog intConfig={intConfig} integrationsMutate={integrationsMutate} syncTaskMutate={syncTaskMutate} />
        )
        }
      </CardContent>
    </Card>
  );
}
