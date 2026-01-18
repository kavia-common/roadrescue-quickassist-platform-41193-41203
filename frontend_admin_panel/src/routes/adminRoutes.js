/**
 * Centralized admin route paths to ensure navigation/route consistency.
 *
 * Keep this minimal: it exists only to prevent mismatched paths between
 * App routing and AdminSidebar links.
 */

export const ADMIN_ROUTES = {
  // Canonical admin base
  root: "/admin",

  // Required admin sections
  dashboard: "/admin/dashboard",
  users: "/admin/users",
  requests: "/admin/requests",
  fees: "/admin/fees",
  analytics: "/admin/analytics",

  // Keep existing demo route (do not remove features)
  smsDemo: "/admin/demo-sms",
};

export const LEGACY_ROUTES = {
  dashboard: "/dashboard",
  users: "/users",
  requests: "/requests",
  fees: "/fees",
  analytics: "/analytics",
  smsDemo: "/demo-sms",
};
