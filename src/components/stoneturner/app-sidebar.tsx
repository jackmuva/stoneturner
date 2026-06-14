import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, SquareLibraryIcon } from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import stoneturnerLogo from "@/assets/stoneturner.png";

export function AppSidebar() {
  const [knowledgeMenu, setKnowledgeMenu] = useState<boolean>(false);
  const { pathname } = useLocation();

  return (
    <Sidebar className="font-mono">
      <SidebarHeader>
        <div className="text-lg italic h-full font-semibold font-mono flex items-center gap-1">
          <img src={stoneturnerLogo} alt="stoneturner-logo" className="animate-rotate" width={25} height={25} />
          <h1>StoneTurner</h1>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-2">
        <Collapsible open={knowledgeMenu} onOpenChange={setKnowledgeMenu}>
          <div className={`flex items-center justify-between px-2
            ${pathname.startsWith("/knowledge") ? "border-r-4 border-black" : "border-r-4 border-background"}`}>
            <NavLink to="/knowledge" end className="flex items-center gap-1">
              <SquareLibraryIcon size={16} />
              <label>Knowledge Base</label>
            </NavLink>
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
