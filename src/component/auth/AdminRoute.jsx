import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Client-side gate for the eventual /admin panel. This is a UX convenience
// only — the authoritative check is requireAdmin() on the server, which any
// real /api/admin/* route must call. Never trust this component alone.
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

  if (appUser?.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
