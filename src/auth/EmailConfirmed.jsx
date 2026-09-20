import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const EmailConfirmed = () => {
  const { user, loading } = useAuth();
  const destination = user ? "/" : "/login";
  const linkLabel = user ? "Continue Shopping" : "Log in to continue";

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Your email has been confirmed</h1>
      <p className="mt-4 text-sm text-gray-600">
        {loading
          ? "Checking your account..."
          : user
            ? "Your account is ready to use."
            : "Your email is confirmed. Log in to continue shopping."}
      </p>
      {!loading && (
        <Link
          to={destination}
          className="mt-8 inline-block bg-black px-6 py-3 text-sm font-semibold text-white"
        >
          {linkLabel}
        </Link>
      )}
    </main>
  );
};

export default EmailConfirmed;
