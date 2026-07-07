import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/stoneturner/app-sidebar";
import { TooltipProvider } from "../ui/tooltip";

export function Layout() {
  return (
    <SidebarProvider>
      <TooltipProvider>
        <AppSidebar />
        <main className="flex-1 min-w-0 h-screen flex">
          <SidebarTrigger className="" />
          <Outlet />
        </main>
      </TooltipProvider>
    </SidebarProvider>
  );
}
