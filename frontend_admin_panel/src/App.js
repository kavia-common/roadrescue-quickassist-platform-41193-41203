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
import { MechanicApprovalsPage } from "./pages/MechanicApprovalsPage";
import { RequestManagementPage } from "./pages/RequestManagementPage";
import { FeeSettingsPage } from "./pages/FeeSettingsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";

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
        <Navbar user={authedAdmin} />
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to={authedAdmin ? "/dashboard" : "/login"} replace />} />
            <Route path="/login" element={<LoginPage onAuthed={setUser} />} />

            <Route
              path="/dashboard"
              element={
                <RequireAuth user={authedAdmin}>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/users"
              element={
                <RequireAuth user={authedAdmin}>
                  <UserManagementPage />
                </RequireAuth>
              }
            />
            <Route
              path="/mechanic-approvals"
              element={
                <RequireAuth user={authedAdmin}>
                  <MechanicApprovalsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/requests"
              element={
                <RequireAuth user={authedAdmin}>
                  <RequestManagementPage />
                </RequireAuth>
              }
            />
            <Route
              path="/fees"
              element={
                <RequireAuth user={authedAdmin}>
                  <FeeSettingsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/analytics"
              element={
                <RequireAuth user={authedAdmin}>
                  <AnalyticsPage />
                </RequireAuth>
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
