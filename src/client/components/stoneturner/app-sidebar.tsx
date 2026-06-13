import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/client/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
import { ChevronDown, RegexIcon, SquareLibraryIcon } from "lucide-react";
import { useState } from "react";

export function AppSidebar() {
  const [knowledgeMenu, setKnowledgeMenu] = useState<boolean>(false);

  return (
    <Sidebar className="font-mono">
      <SidebarHeader>
        <div className="text-lg italic h-full font-semibold font-mono flex items-center gap-1">
          <img src={"/stoneturner.png"} alt="stoneturner-logo" className="animate-rotate" width={25} height={25} />
          <h1>StoneTurner</h1>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-2">
        <Collapsible open={knowledgeMenu} onOpenChange={setKnowledgeMenu}>
          <div className={`flex items-center justify-between px-2
            ${path.startsWith("/app/knowledge") ? "border-r-4 border-black" : "border-r-4 border-background"}`}>
            <div className="flex items-center gap-1" onClick={() => router.push("/app/knowledge")}>
              <SquareLibraryIcon size={16} />
              <label>Knowledge Base</label>
            </div>
            <CollapsibleTrigger asChild>
              <ChevronDown className={`${knowledgeMenu ? "-rotate-90" : ""}`} size={16} />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            Placeholder
          </CollapsibleContent>
        </Collapsible>
      </SidebarContent>
      <SidebarFooter className="pb-4">
      </SidebarFooter>
    </Sidebar >
  )
}
