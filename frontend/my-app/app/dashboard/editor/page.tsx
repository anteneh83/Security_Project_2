"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import useAuth from "@/hooks/useAuth";
import { toast, Toaster } from "react-hot-toast";

interface User {
  _id: string;
  name: string;
  role: string;
}

interface Review {
  _id: string;
  paperId: string;
  score: number;
  comments: string;
  reviewerId?: User;
}

interface Paper {
  _id: string;
  title: string;
  abstract: string;
  keywords: string;
  department: string;
  filePath: string;
  assignedReviewer?: string | User | null;
}

interface RoleRequest {
  _id: string;
  requestedRole: string;
  reason: string;
  status: string;
  timestamp: string;
}

export default function EditorDashboard() {
  const auth = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState<{ [key: string]: string }>({});
  const [reviews, setReviews] = useState<{ [key: string]: Review[] }>({});
  const [editingReview, setEditingReview] = useState<{ [key: string]: Review }>({});
  const [loading, setLoading] = useState(false);

  // --- Change request states ---
  const [newRole, setNewRole] = useState("");
  const [reason, setReason] = useState("");

  const headers = auth.getAuthHeaders().headers;
  const api = axios.create({ baseURL: "http://localhost:4000/api", headers });

  // --- Fetch users (reviewers only) ---
  const fetchUsers = async () => {
    try {
      const res = await api.get("/admin/users");
      const reviewers = res.data.users.filter((u: User) => u.role === "reviewer");
      setUsers(reviewers || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load users");
    }
  };

  // --- Fetch papers ---
  const fetchPapers = async () => {
    try {
      const res = await api.get("/papers");
      setPapers(res.data || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to fetch papers");
    }
  };

  // --- Assign reviewer ---
  const assignReviewer = async (paperId: string, reviewerId: string) => {
    if (!reviewerId) return toast.error("Select a reviewer");
    try {
      await api.put(`/admin/papers/${paperId}/assign-reviewer`, { reviewerId });
      toast.success("Reviewer assigned");
      setPapers((prev) =>
        prev.map((p) =>
          p._id === paperId ? { ...p, assignedReviewer: reviewerId } : p
        )
      );
      setSelectedReviewer((prev) => ({ ...prev, [paperId]: "" }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to assign reviewer");
    }
  };

  // --- Fetch reviews ---
  const fetchReviews = async (paperId: string) => {
    try {
      const res = await api.get(`/reviews/paper/${paperId}`);
      setReviews((prev) => ({ ...prev, [paperId]: res.data.reviews || [] }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to fetch reviews");
    }
  };

  // --- Submit or update review ---
  const submitReview = async (paperId: string, review?: Review) => {
    const score = review?.score ?? 5;
    const comments = review?.comments ?? "";
    if (!score || !comments) return toast.error("Score and comments are required");

    setLoading(true);
    try {
      if (review?._id) {
        await api.put(`/reviews/${review._id}`, { score, comments });
        toast.success("Review updated");
      } else {
        await api.post("/reviews", { paperId, score, comments });
        toast.success("Review submitted");
      }
      fetchReviews(paperId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to submit review");
    } finally {
      setLoading(false);
    }
  };

  // --- Delete review ---
  const deleteReview = async (paperId: string, reviewId: string) => {
    if (!confirm("Are you sure you want to delete this review?")) return;
    try {
      await api.delete(`/reviews/${reviewId}`);
      toast.success("Review deleted");
      fetchReviews(paperId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete review");
    }
  };

  const handleReviewChange = (paperId: string, field: "score" | "comments", value: string) => {
    setEditingReview((prev) => ({
      ...prev,
      [paperId]: { ...prev[paperId], [field]: field === "score" ? Number(value) : value },
    }));
  };

  // --- Change request functions ---
  const submitRoleRequest = async () => {
    if (!newRole) return toast.error("Select a role");
    try {
      await api.post("/admin/roles/request", { requestedRole: newRole, reason });
      toast.success("Role change request submitted");
      setNewRole("");
      setReason("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to submit request");
    }
  };

  
  useEffect(() => {
    setLoading(true);
    fetchUsers();
    fetchPapers();
    setLoading(false);
  }, []);

  if (loading) return <p className="p-8">Loading...</p>;

  return (
    <div className="p-8 space-y-6">
      <Toaster position="top-right" />
       <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold">Editor Dashboard</h1>
        <p className="text-gray-600">Submit new research papers and track review progress.</p>
      </div>
      <button
        onClick={() => {
          auth.logout();
          window.location.href = '/auth/login'; // redirect to login page after logout
        }}
        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
      >
        Logout
      </button>
    </div>

       {/* --- Change Request Section --- */}
      <section className="bg-white p-4 rounded shadow space-y-4 mt-6">
        <h2 className="text-xl font-semibold">Role Change Requests</h2>
        <div className="flex flex-col space-y-2">
          <select
            className="border p-2 rounded"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
          >
            <option value="">Select Role</option>
            <option value="author">Author</option>
            <option value="reviewer">Reviewer</option>
            <option value="editor">Editor</option>
            <option value="hr">HR</option>
            <option value="admin">Admin</option>
          </select>
          <input
            type="text"
            placeholder="Reason for role change"
            className="border p-2 rounded"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={submitRoleRequest}
          >
            Submit Request
          </button>
        </div>
      </section>

      {/* --- Papers Section --- */}
      <section className="bg-white p-4 rounded shadow space-y-4">
        {papers.length === 0 ? (
          <p>No papers available.</p>
        ) : (
          papers.map((paper) => {
            const reviewerName =
              typeof paper.assignedReviewer === "object"
                ? (paper.assignedReviewer as User).name
                : users.find((u) => u._id === paper.assignedReviewer)?.name;

            return (
              <div key={paper._id} className="border p-3 rounded space-y-2">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                  <div>
                    <p className="font-semibold">{paper.title}</p>
                    <p className="text-gray-600">{paper.abstract}</p>
                    <p className="text-sm text-gray-500">Keywords: {paper.keywords}</p>
                    <p className="text-sm text-gray-500">Department: {paper.department}</p>
                  </div>

                  <div className="flex space-x-2 mt-2 md:mt-0">
                    {reviewerName ? (
                      <span className="font-semibold text-green-700">{reviewerName}</span>
                    ) : (
                      <>
                        <select
                          value={selectedReviewer[paper._id] || ""}
                          onChange={(e) =>
                            setSelectedReviewer((prev) => ({
                              ...prev,
                              [paper._id]: e.target.value,
                            }))
                          }
                          className="border p-1 rounded"
                        >
                          <option value="">Select Reviewer</option>
                          {users.map((u) => (
                            <option key={u._id} value={u._id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() =>
                            assignReviewer(paper._id, selectedReviewer[paper._id])
                          }
                          className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                        >
                          Assign
                        </button>
                      </>
                    )}

                    <button
                      className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                      onClick={() => fetchReviews(paper._id)}
                    >
                      View Reviews
                    </button>
                  </div>
                </div>

                {/* Reviews */}
                {reviews[paper._id] && reviews[paper._id].length > 0 && (
                  <div className="mt-2 border-t pt-2 space-y-2">
                    {reviews[paper._id].map((r) => (
                      <div key={r._id} className="p-2 border rounded space-y-1">
                        <p>Score: {r.score}</p>
                        <p>Comments: {r.comments}</p>
                        <p className="text-sm text-gray-500">
                          Reviewer: {r.reviewerId?.name} ({r.reviewerId?.role})
                        </p>
                        <div className="flex space-x-2">
                          <button
                            className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                            onClick={() =>
                              setEditingReview((prev) => ({ ...prev, [paper._id]: { ...r } }))
                            }
                          >
                            Edit
                          </button>
                          <button
                            className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                            onClick={() => deleteReview(paper._id, r._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add / Edit review */}
                <div className="mt-2 border-t pt-2 space-y-2">
                  <h4 className="font-semibold">Add / Edit Review</h4>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    placeholder="Score (1-5)"
                    value={editingReview[paper._id]?.score || ""}
                    onChange={(e) => handleReviewChange(paper._id, "score", e.target.value)}
                    className="border p-1 rounded w-24"
                  />
                  <textarea
                    placeholder="Comments"
                    value={editingReview[paper._id]?.comments || ""}
                    onChange={(e) => handleReviewChange(paper._id, "comments", e.target.value)}
                    className="border p-1 rounded w-full"
                  />
                  <button
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    onClick={() => submitReview(paper._id, editingReview[paper._id])}
                    disabled={loading}
                  >
                    {editingReview[paper._id]?._id ? "Update Review" : "Submit Review"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>

     
    </div>
  );
}
