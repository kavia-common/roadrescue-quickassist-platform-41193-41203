import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import { Navbar } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import { RequireAuth } from "./routes/RequireAuth";

import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UserManagementPage } from "./pages/UserManagementPage";
import { RequestManagementPage } from "./pages/RequestManagementPage";
import { FeeSettingsPage } from "./pages/FeeSettingsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { TwilioSmsDemoCard } from "./components/demo/TwilioSmsDemoCard";

import { AuthProvider, useAuth } from "./auth/AuthContext";

function AppRoutes() {
  const { isAuthenticated, role } = useAuth();
  const authedAdmin = isAuthenticated && role === "admin";

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to={authedAdmin ? "/dashboard" : "/login"} replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/users"
            element={
              <RequireAuth>
                <UserManagementPage />
              </RequireAuth>
            }
          />
          <Route
            path="/requests"
            element={
              <RequireAuth>
                <RequestManagementPage />
              </RequireAuth>
            }
          />
          <Route
            path="/fees"
            element={
              <RequireAuth>
                <FeeSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/analytics"
            element={
              <RequireAuth>
                <AnalyticsPage />
              </RequireAuth>
            }
          />

          <Route
            path="/demo-sms"
            element={
              <RequireAuth>
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  /** Admin panel entry: approvals, requests, fees, analytics. (DEMO auth mode) */
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
