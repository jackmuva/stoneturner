import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, SquareLibraryIcon, Sun, Moon, Monitor, type LucideProps } from "lucide-react";
import { useState, type ForwardRefExoticComponent, type RefAttributes } from "react";
import { NavLink, useLocation } from "react-router-dom";
import stoneturnerLogo from "@/assets/stoneturner.png";
import { useTheme } from "@/providers/theme";
import { Button } from "@/components/ui/button";

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor
};

export function AppSidebar() {
  const [knowledgeMenu, setKnowledgeMenu] = useState<boolean>(false);
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
      <SidebarHeader>
        <div className="flex items-center justify-between gap-1">
          <div className="text-lg italic h-full font-semibold font-sans flex items-center gap-1">
            <img src={stoneturnerLogo} alt="stoneturner-logo" className="animate-rotate" width={25} height={25} />
            <h1>StoneTurner</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={cycleTheme} title={`Theme: ${theme}`}>
            <Icon size={18} />
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-2">
        <Collapsible open={knowledgeMenu} onOpenChange={setKnowledgeMenu}>
          <div className={`flex items-center justify-between px-2
            ${pathname.startsWith("/knowledge") ? "border-r-4 border-foreground" : "border-r-4 border-background"}`}>
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
  );
}
