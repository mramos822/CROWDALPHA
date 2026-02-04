import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  PieChart,
  Bell,
  Calendar,
  Users,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Portfolio", href: "/portfolio", icon: PieChart },
  { name: "Signals", href: "/signals", icon: Bell },
  { name: "IPOs", href: "/ipos", icon: Calendar },
  { name: "Groups", href: "/groups", icon: Users },
];

export function MobileNav() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t md:hidden">
      <div className="grid grid-cols-6 gap-1 p-2">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center p-2 text-xs font-medium rounded-md transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5 mb-1" />
            <span className="truncate">{item.name}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
