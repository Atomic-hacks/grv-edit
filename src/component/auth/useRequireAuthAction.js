import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Gate a one-off action (not a whole route) behind login, e.g. "Join
// Waitlist". Redirects to /login?returnTo=<current path> if signed out,
// otherwise runs the action.
export const useRequireAuthAction = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (action) => {
    if (!user) {
      const returnTo = `${location.pathname}${location.search}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    action();
  };
};
