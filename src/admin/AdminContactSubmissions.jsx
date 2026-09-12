import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const messagePreview = (message) => {
  const normalizedMessage = message.replace(/\s+/g, " ").trim();
  return normalizedMessage.length > 140
    ? `${normalizedMessage.slice(0, 140)}...`
    : normalizedMessage;
};

const AdminContactSubmissions = () => {
  const { session } = useAuth();
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState("");
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();
  const submissionsQuery = useQuery({
    queryKey: ["admin", "contact-submissions"],
    queryFn: () => request("/api/admin/contact-submissions"),
    enabled: Boolean(session),
  });
  const submissions = submissionsQuery.data || [];
  const loading = submissionsQuery.isPending;
  const displayError = error || submissionsQuery.error?.message;

  const openSubmission = async (submission) => {
    setExpandedId((currentId) =>
      currentId === submission.id ? null : submission.id,
    );
    if (submission.read) return;

    try {
      await request(`/api/admin/contact-submissions/${submission.id}`, {
        method: "PUT",
      });
      queryClient.setQueryData(["admin", "contact-submissions"], (current) =>
        (current || []).map((currentSubmission) =>
          currentSubmission.id === submission.id
            ? { ...currentSubmission, read: true }
            : currentSubmission,
        ),
      );
      await queryClient.invalidateQueries({
        queryKey: ["admin", "contact-submissions"],
      });
    } catch (markReadError) {
      setError(markReadError.message || "Unable to mark submission as read.");
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
      <div className="border-b border-black pb-6">
        <Link
          to="/admin"
          className="text-xs uppercase tracking-[0.2em] text-gray-500"
        >
          Admin
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Contact submissions</h1>
      </div>

      {displayError && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {displayError}
        </div>
      )}

      <div className="mt-8 border-t border-black">
        {loading && (
          <p className="px-3 py-8 text-sm text-gray-500">
            <Spinner label="Loading submissions" />
          </p>
        )}
        {!loading && submissions.length === 0 && (
          <p className="px-3 py-8 text-sm text-gray-500">
            No contact submissions yet.
          </p>
        )}
        {!loading &&
          submissions.map((submission) => {
            const isExpanded = expandedId === submission.id;
            return (
              <button
                key={submission.id}
                type="button"
                onClick={() => openSubmission(submission)}
                className={`block w-full border-b border-gray-200 px-3 py-5 text-left transition-colors hover:bg-gray-50 ${
                  submission.read ? "bg-white" : "bg-gray-100"
                }`}
                aria-expanded={isExpanded}
              >
                <div className="grid gap-4 md:grid-cols-[1.1fr_1fr_1.4fr_auto] md:items-start">
                  <div>
                    <p
                      className={
                        submission.read ? "font-medium" : "font-semibold"
                      }
                    >
                      {submission.name}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {submission.email}
                    </p>
                  </div>
                  <p
                    className={
                      submission.read ? "font-medium" : "font-semibold"
                    }
                  >
                    {submission.subject}
                  </p>
                  <p className="text-sm text-gray-600">
                    {isExpanded
                      ? submission.message
                      : messagePreview(submission.message)}
                  </p>
                  <div className="text-left text-xs text-gray-500 md:text-right">
                    <p>{formatDate(submission.createdAt)}</p>
                    <p
                      className={`mt-2 font-medium uppercase tracking-[0.15em] ${
                        submission.read ? "text-gray-500" : "text-black"
                      }`}
                    >
                      {submission.read ? "Read" : "Unread"}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </main>
  );
};

export default AdminContactSubmissions;
