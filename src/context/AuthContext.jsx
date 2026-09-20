import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
const HAS_ACCOUNT_STORAGE_KEY = "grv_has_account";

const rememberAccountOnThisBrowser = () => {
  window.localStorage.setItem(HAS_ACCOUNT_STORAGE_KEY, "true");
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const appUserQuery = useQuery({
    queryKey: ["me", session?.user?.id],
    queryFn: async () => {
      const response = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      return response.ok ? ((await response.json())?.user ?? null) : null;
    },
    enabled: Boolean(session?.access_token),
  });
  const appUser = appUserQuery.data;
  const appUserLoading = appUserQuery.isPending;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      },
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  // appUser is the Prisma User row (id/email/name/role) — the authoritative
  // source for role, fetched via /api/me rather than trusted from the client.
  const signUp = async ({ email, password, name }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    if (error) throw error;
    if (!data.user?.id) throw new Error("Could not create your account.");
    const verificationHeaders = { "Content-Type": "application/json" };
    if (data.session?.access_token) {
      verificationHeaders.Authorization = `Bearer ${data.session.access_token}`;
    }
    const verificationResponse = await fetch("/api/auth/send-verification", {
      method: "POST",
      headers: verificationHeaders,
      body: JSON.stringify({ userId: data.user.id }),
    });
    if (!verificationResponse.ok) {
      const body = await verificationResponse.json().catch(() => ({}));
      throw new Error(body.error || "Could not send your verification code.");
    }
    rememberAccountOnThisBrowser();
    return data;
  };

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    rememberAccountOnThisBrowser();
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      appUser,
      appUserLoading,
      loading,
      signUp,
      signIn,
      signOut,
    }),
    [session, appUser, appUserLoading, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
