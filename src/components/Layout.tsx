import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Banknote,
  Bell,
  ClipboardList,
  FileText,
  Fuel,
  LayoutDashboard,
  LogOut,
  Map,
  MoreHorizontal,
  Navigation,
  Route,
  Settings,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { useTaw } from "../state/TawStore";
import { getCloudConfig } from "../lib/cloud";
import { Avatar, Badge } from "./ui";

const OWNER_TABS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/dispatch", label: "Dispatch", icon: Navigation },
  { to: "/fleet", label: "Fleet", icon: Truck },
  { to: "/trips", label: "History", icon: ClipboardList },
  { to: "/more", label: "More", icon: MoreHorizontal },
];

const MORE_LINKS = [
  { to: "/staff", label: "Drivers & crew", icon: Users, sub: "Permanent, temporary, helpers" },
  { to: "/catalog", label: "Vehicle directory", icon: BadgeCheck, sub: "Auto-spec lookup catalog" },
  { to: "/compliance", label: "Compliance & alerts", icon: Bell, sub: "Renewals and due dates" },
  { to: "/maintenance", label: "Maintenance", icon: Wrench, sub: "Services, repairs, warranties" },
  { to: "/fuel", label: "Fuel & mileage", icon: Fuel, sub: "Refills and system km/L" },
  { to: "/invoices", label: "Invoices", icon: FileText, sub: "IRD VAT tax invoices & receipts" },
  { to: "/finance", label: "Finance & P&L", icon: Banknote, sub: "Payroll, expenses, profitability" },
  { to: "/partners", label: "Partner network", icon: Route, sub: "Subcontracting & settlement" },
  { to: "/map", label: "Live fleet map", icon: Map, sub: "Real-time GPS" },
  { to: "/settings", label: "Settings", icon: Settings, sub: "Company, WAHA and portal connection" },
];

export function Layout() {
  const { state, mode, leave, notify } = useTaw();
  const location = useLocation();
  const navigate = useNavigate();
  const urgent = state.notifications.filter((n) => n.severity === "URGENT").length;
  const portalUrl = getCloudConfig().portalUrl;

  async function signOut() {
    await leave();
    notify({ tone: "info", text: "Signed out." });
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("/dashboard")}>
          <span className="brand-mark">TAW</span>
          <span className="brand-text">
            <strong>Vehicle Carrier</strong>
            <small>{state.company.name}</small>
          </span>
        </button>
        <div className="topbar-actions">
          <button className="icon-btn notify-btn" title="Alerts" onClick={() => navigate("/compliance")}>
            <Bell size={18} />
            {urgent > 0 && <span className="notify-dot">{urgent}</span>}
          </button>
          <Badge tone="info" plain>Owner</Badge>
          <button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={() => void signOut()}>
            <LogOut size={18} />
          </button>
          <Avatar name={state.company.name} size="sm" />
        </div>
      </header>

      <main className={`main ${OWNER_TABS.some((tab) => location.pathname.startsWith(tab.to)) ? "with-bottom" : ""}`}>
        <Outlet />
      </main>

      {OWNER_TABS.some((tab) => location.pathname.startsWith(tab.to)) && (
        <nav className="bottom-nav">
          {OWNER_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = location.pathname.startsWith(tab.to);
            return (
              <NavLink key={tab.to} to={tab.to} className={`nav-item ${active ? "active" : ""}`}>
                <span className="nav-icon-wrap">
                  <Icon size={20} />
                  {tab.to === "/dashboard" && urgent > 0 && <span className="nav-dot" />}
                </span>
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}

      {location.pathname === "/more" && (
        <div className="more-grid">
          {MORE_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink key={link.to} to={link.to} className="more-card">
                <span className="more-icon"><Icon size={20} /></span>
                <span><strong>{link.label}</strong><small>{link.sub}</small></span>
              </NavLink>
            );
          })}
          {portalUrl && (
            <a className="more-card" href={portalUrl} target="_blank" rel="noreferrer">
              <span className="more-icon"><BadgeCheck size={20} /></span>
              <span><strong>Developer portal</strong><small>Licensing & releases</small></span>
            </a>
          )}
          <button
            className="more-card"
            onClick={() => void signOut()}
          >
            <span className="more-icon"><LogOut size={20} /></span>
            <span><strong>Sign out</strong><small>{mode === "demo" ? "Leave owner demo" : "Leave cloud"}</small></span>
          </button>
        </div>
      )}

      <footer className="app-foot">
        <Badge tone={mode === "demo" ? "warn" : "ok"} plain>
          {mode === "demo" ? "Local demo" : "Cloud"}
        </Badge>
        <span>TAW · RAVBsoft product line · v0.1</span>
      </footer>
    </div>
  );
}
