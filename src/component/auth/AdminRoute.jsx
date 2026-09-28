import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Client-side gate for the /admin panel. This is a UX convenience only —
// the authoritative check is requireAdmin()/requireRole() on the server,
// which every real /api/admin/* route must call. Never trust this
// component alone. Any staff role may open the panel shell; individual
// screens/actions still enforce their own narrower role requirement
// server-side (e.g. only OWNER can grant roles, only ADMIN can process a
// refund).
const STAFF_ROLES = ["OWNER", "ADMIN", "SUPPORT", "FULFILMENT", "ANALYST"];

const AdminRoute = ({ children }) => {
  const { user, loading, appUser, appUserLoading } = useAuth();
  const location = useLocation();

  if (loading || (user && appUserLoading)) return null;

  if (!user) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  if (!STAFF_ROLES.includes(appUser?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
