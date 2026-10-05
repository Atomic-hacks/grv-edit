import React from "react";
import ErrorState from "./component/ui/ErrorState";

// The catch-all for any URL that doesn't match a real route — without
// this, a dead or mistyped link rendered nothing at all (React Router
// simply has no route to match), a blank page with no way back.
const NotFound = () => (
  <main className="page-shell flex min-h-screen items-center justify-center">
    <ErrorState
      tone="not-found"
      title="This page doesn't exist"
      message="The link may be broken, or the page may have moved."
      secondaryTo="/"
      secondaryLabel="Back to home"
    />
  </main>
);

export default NotFound;
