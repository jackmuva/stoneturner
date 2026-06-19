import type { IntegrationConfig } from "@/core/models/models";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { IntegrationDialog } from "./integration-dialog";
import { BoltIcon } from "lucide-react";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import { useNavigate } from "react-router-dom";

export const IntegrationCard = ({
  intConfig,
  integrations,
  syncing,
  integrationsMutate,
  openDialog,
}: {
  intConfig: IntegrationConfig,
  integrations: IntegrationCredential[],
  syncing: boolean,
  integrationsMutate: () => void,
  openDialog?: boolean,
}) => {
  let navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex gap-2 items-center w-full">
          <div className="flex items-center gap-2 text-base">
            <img src={intConfig.icon} alt={intConfig.icon} height={30} width={30} />
            <label>
              {intConfig.integration} Data
            </label>
          </div>
          {integrations.filter((connectedInt: IntegrationCredential) => connectedInt.integration === intConfig.integration).length > 0 ? (
            !syncing ? (
              <div className="w-3 h-3 rounded-full bg-green-500" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                <div>
                  Syncing
                </div>
              </div>
            )
          ) : (<></>)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {integrations.filter((connectedInt: IntegrationCredential) => !openDialog && connectedInt.integration === intConfig.integration).length > 0 ? (
          <div className="flex flex-col gap-2 w-full">
            <Button variant={"default"} className="w-full"
              onClick={async () => navigate(`/knowledge/data/${intConfig.integration}`)}>
              <BoltIcon size={16} />
              Configure
            </Button>
          </div>
        ) : (
          <IntegrationDialog intConfig={intConfig} integrationsMutate={integrationsMutate} openDialog={openDialog}/>
        )}
      </CardContent>
    </Card>
  );
}
