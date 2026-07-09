import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, SquareLibraryIcon, ActivityIcon, Sun, Moon, Monitor, type LucideProps } from "lucide-react";
import { useState, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { NavLink, useLocation } from "react-router-dom";
import stoneturnerLogo from "@/assets/stoneturner.png";
import { useTheme } from "@/providers/theme";
import { Button } from "@/components/ui/button";
import { Badge } from "../ui/badge";

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor
};

export function AppSidebar() {
  const [knowledgeMenu, setKnowledgeMenu] = useState<boolean>(false);
  const [monitorMenu, setMonitorMenu] = useState<boolean>(false);
  const { pathname } = useLocation();
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const themes = ["light", "dark"] as const;
    const currentIndex = themes.indexOf(theme as (typeof themes)[number]);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]!);
  };

  const Icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>> = themeIcons[theme];

  return (
    <Sidebar className="font-sans">
      <SidebarHeader className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-1">
          <div className="text-lg italic h-full font-semibold font-sans flex items-center gap-1">
            <img src={stoneturnerLogo} alt="stoneturner-logo" className="animate-rotate" width={25} height={25} />
            <h1>StoneTurner</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={cycleTheme} title={`Theme: ${theme}`}>
            <Icon size={18} />
          </Button>
        </div>
        {process.env.BUN_PUBLIC_DEV_MODE !== "false" && <Badge className="px-4">
          Dev Mode
        </Badge>}
      </SidebarHeader>
      <SidebarContent className="gap-2">
          <div className={`flex items-center justify-between px-2
            ${pathname.startsWith("/knowledge") ? "border-r-4 border-foreground" : "border-r-4 border-background"}`}>
            <NavLink to={"/knowledge"} end className="flex items-center gap-1">
              <SquareLibraryIcon size={16} />
              <label>Knowledge Base</label>
            </NavLink>
          </div>
          <div className={`flex items-center justify-between px-2
          ${pathname.startsWith("/monitoring") ? "border-r-4 border-foreground" : "border-r-4 border-background"}`}>
            <NavLink to={"/monitoring"} className="flex items-center gap-1">
              <ActivityIcon size={16} />
              <label>Sync Monitoring</label>
            </NavLink>
          </div>
      </SidebarContent >
      <SidebarFooter className="pb-4">
      </SidebarFooter>
    </Sidebar >
  );
}
