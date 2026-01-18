import React, { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import { Navbar } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import { RequireAuth } from "./routes/RequireAuth";
import { dataService } from "./services/dataService";

import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UserManagementPage } from "./pages/UserManagementPage";
import { RequestManagementPage } from "./pages/RequestManagementPage";
import { FeeSettingsPage } from "./pages/FeeSettingsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { TwilioSmsDemoCard } from "./components/demo/TwilioSmsDemoCard";

import { AdminAuth } from "./pages/admin/AdminAuth";
import { AdminLayout } from "./components/layout/AdminLayout";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { ADMIN_ROUTES, LEGACY_ROUTES } from "./routes/adminRoutes";

// PUBLIC_INTERFACE
function App() {
  /** Admin panel entry: approvals, requests, fees, analytics. */
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const u = await dataService.getCurrentUser();
      if (mounted) {
        setUser(u);
        setBooted(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!booted)
    return (
      <div className="app-shell">
        <div className="container">
          <div className="skeleton">Loading…</div>
        </div>
      </div>
    );

  const authedAdmin = user && user.role === "admin" ? user : null;

  return (
    <BrowserRouter>
      <div className="app-shell">
        {/* Keep existing top navbar/footer for legacy routes.
            Admin routes render their own sidebar layout. */}
        <Navbar user={authedAdmin} />
        <main className="main">
          <Routes>
            {/* Legacy routes (kept for backwards compatibility) */}
            <Route path="/" element={<Navigate to={authedAdmin ? LEGACY_ROUTES.dashboard : "/login"} replace />} />
            <Route path="/login" element={<LoginPage onAuthed={setUser} />} />

            {/* Legacy group: keep functional, but also provide canonical redirects into /admin/* */}
            <Route
              path={LEGACY_ROUTES.dashboard}
              element={
                <RequireAuth user={authedAdmin}>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path={LEGACY_ROUTES.users}
              element={
                <RequireAuth user={authedAdmin}>
                  <UserManagementPage />
                </RequireAuth>
              }
            />
            <Route
              path={LEGACY_ROUTES.requests}
              element={
                <RequireAuth user={authedAdmin}>
                  <RequestManagementPage />
                </RequireAuth>
              }
            />
            <Route
              path={LEGACY_ROUTES.fees}
              element={
                <RequireAuth user={authedAdmin}>
                  <FeeSettingsPage />
                </RequireAuth>
              }
            />
            <Route
              path={LEGACY_ROUTES.analytics}
              element={
                <RequireAuth user={authedAdmin}>
                  <AnalyticsPage />
                </RequireAuth>
              }
            />
            <Route
              path={LEGACY_ROUTES.smsDemo}
              element={
                <RequireAuth user={authedAdmin}>
                  <div className="container">
                    <div className="hero">
                      <h1 className="h1">SMS Demo</h1>
                      <p className="lead">Simulate the mocked “Mechanic accepts job” event.</p>
                    </div>
                    <TwilioSmsDemoCard title="Mechanic accepts job (Demo)" />
                  </div>
                </RequireAuth>
              }
            />

            {/* Admin route group */}
            <Route
              path={ADMIN_ROUTES.root}
              element={<Navigate to={authedAdmin ? ADMIN_ROUTES.dashboard : ADMIN_ROUTES.root} replace />}
            />
            <Route path="/admin/*" element={<AdminAuth />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route
              path={ADMIN_ROUTES.dashboard}
              element={
                <AdminLayout>
                  <DashboardPage />
                </AdminLayout>
              }
            />
            <Route
              path={ADMIN_ROUTES.users}
              element={
                <AdminLayout>
                  <UserManagementPage />
                </AdminLayout>
              }
            />
            <Route
              path={ADMIN_ROUTES.requests}
              element={
                <AdminLayout>
                  <RequestManagementPage />
                </AdminLayout>
              }
            />
            <Route
              path={ADMIN_ROUTES.fees}
              element={
                <AdminLayout>
                  <FeeSettingsPage />
                </AdminLayout>
              }
            />
            <Route
              path={ADMIN_ROUTES.analytics}
              element={
                <AdminLayout>
                  <AnalyticsPage />
                </AdminLayout>
              }
            />
            <Route
              path={ADMIN_ROUTES.smsDemo}
              element={
                <AdminLayout>
                  <div className="container">
                    <div className="hero">
                      <h1 className="h1">SMS Demo</h1>
                      <p className="lead">Simulate the mocked “Mechanic accepts job” event.</p>
                    </div>
                    <TwilioSmsDemoCard title="Mechanic accepts job (Demo)" />
                  </div>
                </AdminLayout>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
