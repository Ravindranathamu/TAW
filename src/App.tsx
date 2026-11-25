import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { X } from "lucide-react";
import { TawProvider, useTaw } from "./state/TawStore";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { SetupPage } from "./pages/Setup";
import { DashboardPage } from "./pages/Dashboard";
import { DispatchPage } from "./pages/Dispatch";
import { FleetPage } from "./pages/Fleet";
import { VehicleDetailPage } from "./pages/VehicleDetail";
import { StaffPage, StaffDetailPage } from "./pages/Staff";
import { CatalogPage } from "./pages/Catalog";
import { CompliancePage } from "./pages/Compliance";
import { MaintenancePage } from "./pages/Maintenance";
import { FuelPage } from "./pages/Fuel";
import { TripsPage, TripDetailPage } from "./pages/Trips";
import { InvoicesPage } from "./pages/Invoices";
import { FinancePage } from "./pages/Finance";
import { PartnersPage } from "./pages/Partners";
import { ViolationsPage } from "./pages/Violations";
import { MapPage } from "./pages/MapView";
import { DriverPage } from "./pages/DriverApp";
import { TrackPage } from "./pages/Track";
import { SettingsPage } from "./pages/Settings";
import { Card, EmptyState } from "./components/ui";
import { LicenceGate } from "./components/LicencePrompts";

function ToastBar() {
  const { toast, clearToast } = useTaw();
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.tone}`} role="status">
      <span>{toast.text}</span>
      <button onClick={clearToast} aria-label="Dismiss"><X size={16} /></button>
    </div>
  );
}

function RoleGuard({ allow, children }: { allow: "owner" | "driver"; children: ReactNode }) {
  const { mode, role } = useTaw();
  if (!mode) return <Navigate to={allow === "driver" ? "/driver-login" : "/login"} replace />;
  if (role !== allow) {
    return <Navigate to={role === "driver" ? "/driver" : "/dashboard"} replace />;
  }
  return <>{children}</>;
}

function NotFound() {
  return (
    <Card>
      <EmptyState
        message="This TAW page does not exist."
        action={<a className="btn btn-brand" href="/dashboard">Back to dashboard</a>}
      />
    </Card>
  );
}

function Shell() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Entry />} />
        <Route path="/login" element={<LoginPage kind="owner" />} />
        <Route path="/driver-login" element={<LoginPage kind="driver" />} />
        <Route path="/track/:token" element={<TrackPage />} />

        <Route path="/driver" element={<RoleGuard allow="driver"><LicenceGate><DriverPage /></LicenceGate></RoleGuard>} />
        <Route path="/driver/:tripId" element={<RoleGuard allow="driver"><LicenceGate><DriverPage /></LicenceGate></RoleGuard>} />

        <Route element={<RoleGuard allow="owner"><LicenceGate><Layout /></LicenceGate></RoleGuard>}>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dispatch" element={<DispatchPage />} />
          <Route path="/fleet" element={<FleetPage />} />
          <Route path="/fleet/:id" element={<VehicleDetailPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/staff/:id" element={<StaffDetailPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/fuel" element={<FuelPage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/violations" element={<ViolationsPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <ToastBar />
    </>
  );
}

function Entry() {
  const { mode, role } = useTaw();
  if (!mode) return <Navigate to="/login" replace />;
  return <Navigate to={role === "driver" ? "/driver" : "/dashboard"} replace />;
}

export function App() {
  return (
    <TawProvider>
      <Shell />
    </TawProvider>
  );
}
