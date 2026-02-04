import { NavLink } from "react-router-dom";
import { useUiStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import {
  Home,
  PieChart,
  Bell,
  Calendar,
  Users,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Portfolio", href: "/portfolio", icon: PieChart },
  { name: "Signals", href: "/signals", icon: Bell },
  { name: "IPOs", href: "/ipos", icon: Calendar },
  { name: "Groups", href: "/groups", icon: Users },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <div className={cn(
      "hidden md:flex md:flex-col md:fixed md:inset-y-0 md:top-16 md:w-64 md:border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-all duration-300",
      sidebarCollapsed && "md:w-16"
    )}>
      <div className="flex-1 flex flex-col pt-6 pb-4 overflow-y-auto">
        <div className="flex-1 px-4 space-y-2">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800",
                  sidebarCollapsed && "justify-center px-3"
                )
              }
            >
              <item.icon className={cn(
                "h-5 w-5 flex-shrink-0",
                sidebarCollapsed ? "" : "mr-3"
              )} />
              {!sidebarCollapsed && (
                <span className="truncate">{item.name}</span>
              )}
            </NavLink>
          ))}
        </div>
      </div>
      
      <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-gray-700 p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            "w-full justify-start text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white",
            sidebarCollapsed && "justify-center"
          )}
        >
          <ChevronLeft className={cn(
            "h-4 w-4 transition-transform",
            sidebarCollapsed && "rotate-180"
          )} />
          {!sidebarCollapsed && (
            <span className="ml-2 text-sm">Collapse</span>
          )}
        </Button>
      </div>
    </div>
  );
}