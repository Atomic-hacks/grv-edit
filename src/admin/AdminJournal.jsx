import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const formatPublishedAt = (post) =>
  post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "Draft";

const AdminJournal = () => {
  const { session } = useAuth();
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);

  const queryClient = useQueryClient();
  const journalQuery = useQuery({
    queryKey: ["admin", "journal"],
    queryFn: () => request("/api/admin/journal"),
    enabled: Boolean(session),
  });
  const posts = journalQuery.data || [];
  const loading = journalQuery.isPending;
  const displayError = error || journalQuery.error?.message;

  const deletePost = async (id) => {
    if (!window.confirm("Delete this journal post?")) return;

    setError("");
    setDeletingId(id);
    try {
      await request(`/api/admin/journal/${id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["admin", "journal"] });
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-black pb-6">
        <div>
          <Link
            to="/admin"
            className="text-xs uppercase tracking-[0.2em] text-gray-500"
          >
            Admin
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Journal</h1>
        </div>
        <Link
          to="/admin/journal/new"
          className="border border-black bg-black px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black"
        >
          New Post
        </Link>
      </div>

      {displayError && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {displayError}
        </div>
      )}

      <div className="mt-8 overflow-x-auto border-t border-black">
        <table className="w-full min-w-175 text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-[0.15em] text-gray-500">
            <tr>
              <th className="px-3 py-4 font-medium">Title</th>
              <th className="px-3 py-4 font-medium">Status</th>
              <th className="px-3 py-4 font-medium">Published</th>
              <th className="px-3 py-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="4" className="px-3 py-8 text-gray-500">
                  <Spinner label="Loading journal posts" />
                </td>
              </tr>
            )}
            {!loading && posts.length === 0 && (
              <tr>
                <td colSpan="4" className="px-3 py-8 text-gray-500">
                  No journal posts yet.
                </td>
              </tr>
            )}
            {posts.map((post) => (
              <tr
                key={post.id}
                className="border-b border-gray-200 align-middle"
              >
                <td className="px-3 py-4 font-medium">{post.title}</td>
                <td className="px-3 py-4">
                  <span
                    className={
                      post.published ? "text-green-700" : "text-gray-500"
                    }
                  >
                    {post.published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-3 py-4">{formatPublishedAt(post)}</td>
                <td className="px-3 py-4">
                  <div className="flex justify-end gap-4">
                    <Link
                      to={`/admin/journal/${post.id}/edit`}
                      className="text-sm underline"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => deletePost(post.id)}
                      disabled={deletingId === post.id}
                      className="text-sm text-red-700 underline"
                    >
                      {deletingId === post.id ? (
                        <Spinner label="Deleting" />
                      ) : (
                        "Delete"
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default AdminJournal;
