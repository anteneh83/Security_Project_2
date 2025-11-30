"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import useAuth from "@/hooks/useAuth";
import { toast, Toaster } from "react-hot-toast";

interface Paper {
  _id: string;
  title: string;
  abstract: string;
  keywords: string;
  department: string;
  fileName: string;
}

interface Review {
  _id: string;
  paperId: string;
  reviewerId: { _id: string; name: string };
  score: number;
  comments: string;
}

export default function ReviewerDashboard() {
  const auth = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [filteredPapers, setFilteredPapers] = useState<Paper[]>([]);
  const [reviews, setReviews] = useState<{ [key: string]: Review[] }>({});
  const [newReview, setNewReview] = useState<{ [key: string]: { score: number; comments: string } }>({});
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [newRole, setNewRole] = useState("");
  const [reason, setReason] = useState("");

  const api = axios.create({
    baseURL: "http://localhost:4000/api",
    headers: auth.getAuthHeaders().headers,
  });

  // Fetch all assigned papers
  const fetchPapers = async () => {
    try {
      const res = await api.get("/papers/");
      setPapers(res.data || []);
      setFilteredPapers(res.data || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to fetch papers");
    }
  };
// Filter papers based on department and keywords
const applyFilters = () => {
  let temp = [...papers];

  if (filterDepartment.trim() !== "") {
    temp = temp.filter((p) =>
      p.department?.toLowerCase().includes(filterDepartment.toLowerCase())
    );
  }

  if (filterKeyword.trim() !== "") {
    temp = temp.filter((p) => {
      const keywordsStr = Array.isArray(p.keywords)
        ? p.keywords.join(" ") // convert array to string
        : p.keywords || ""; // fallback to empty string
      return keywordsStr.toLowerCase().includes(filterKeyword.toLowerCase());
    });
  }

  setFilteredPapers(temp);
};


  // Fetch reviews for a paper
  const fetchReviews = async (paperId: string) => {
    try {
      const res = await api.get(`/reviews/paper/${paperId}`);
      setReviews((prev) => ({ ...prev, [paperId]: res.data.reviews || [] }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to fetch reviews");
    }
  };

  // Submit a new review
  const submitReview = async (paperId: string) => {
    const reviewData = newReview[paperId];
    if (!reviewData || reviewData.score === undefined || reviewData.comments.trim() === "") {
      return toast.error("Score and comment are required");
    }
    setLoading(true);
    try {
      await api.post("/reviews/", { paperId, score: reviewData.score, comments: reviewData.comments });
      toast.success("Review submitted");
      setNewReview((prev) => ({ ...prev, [paperId]: { score: 0, comments: "" } }));
      fetchReviews(paperId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to submit review");
    } finally {
      setLoading(false);
    }
  };

  // Update an existing review
  const updateReview = async (review: Review) => {
    if (review.score === undefined || review.comments.trim() === "") {
      return toast.error("Score and comment are required");
    }
    setLoading(true);
    try {
      await api.put(`/reviews/${review._id}`, { score: review.score, comments: review.comments });
      toast.success("Review updated");
      fetchReviews(review.paperId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update review");
    } finally {
      setLoading(false);
    }
  };

  // Delete a review
  const deleteReview = async (review: Review) => {
    if (!confirm("Are you sure you want to delete this review?")) return;
    setLoading(true);
    try {
      await api.delete(`/reviews/${review._id}`);
      toast.success("Review deleted");
      fetchReviews(review.paperId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete review");
    } finally {
      setLoading(false);
    }
  };

   // Submit new role request
  const submitRequest = async () => {
    if (!newRole) return toast.error("Please select a role");
    setLoading(true);
    try {
      await api.post("/admin/roles/request", { requestedRole: newRole, reason });
      toast.success("Role change request submitted");
      setNewRole("");
      setReason("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };


  // Download paper PDF
  const downloadPaper = async (id: string, fileName: string) => {
    try {
      const res = await api.get(`/papers/${id}/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to download file");
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filterDepartment, filterKeyword, papers]);

  return (
    <div className="p-8 space-y-6">
      <Toaster position="top-right" />
      
       <div className="flex justify-between items-center">
      <div>
      <h1 className="text-3xl font-bold">Reviewer Dashboard</h1>
      <p className="mt-2 text-gray-600">
        View assigned papers, submit, update, and manage your reviews.
      </p>
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
    {/* Role Request Form */}
      <section className="bg-white p-4 rounded shadow space-y-4">
        <h2 className="text-xl font-semibold">Submit a Role Change Request</h2>
        <div className="flex flex-col space-y-2">
          <select
            className="border p-2 rounded"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            disabled={loading}
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
            disabled={loading}
          />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={submitRequest}
            disabled={loading}
          >
            Submit Request
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-white p-4 rounded shadow space-y-2">
        <h2 className="text-lg font-semibold">Filter Papers</h2>
        <div className="flex flex-col md:flex-row md:space-x-2 space-y-2 md:space-y-0">
          <input
            type="text"
            placeholder="Filter by Department"
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="border p-2 rounded flex-1"
          />
          <input
            type="text"
            placeholder="Filter by Keyword"
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            className="border p-2 rounded flex-1"
          />
          <button
            onClick={applyFilters}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Apply Filters
          </button>
        </div>
      </section>

      {/* Assigned Papers */}
      <section className="bg-white p-4 rounded shadow space-y-4">
        <h2 className="text-xl font-semibold">Assigned Papers</h2>
        {filteredPapers.length === 0 ? (
          <p>No papers match your filters.</p>
        ) : (
          filteredPapers.map((p) => (
            <div key={p._id} className="border p-3 rounded space-y-2">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-gray-600">{p.abstract}</p>
                  <p className="text-sm text-gray-500">Keywords: {p.keywords}</p>
                  <p className="text-sm text-gray-500">Department: {p.department}</p>
                </div>
                <div className="mt-2 md:mt-0 flex space-x-2">
                  <button
                    className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                    onClick={() => downloadPaper(p._id, p.fileName)}
                  >
                    Download PDF
                  </button>
                  <button
                    className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    onClick={() => fetchReviews(p._id)}
                  >
                    View Reviews
                  </button>
                </div>
              </div>

              {/* Existing Reviews */}
              {reviews[p._id] && reviews[p._id].length > 0 && (
                <div className="mt-2 border-t pt-2 space-y-2">
                  <h3 className="font-semibold">Existing Reviews</h3>
                  {reviews[p._id].map((r) => (
                    <div key={r._id} className="border p-2 rounded space-y-1">
                      <div className="flex space-x-2 items-center">
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={r.score}
                          onChange={(e) =>
                            setReviews((prev) => ({
                              ...prev,
                              [p._id]: prev[p._id].map((rev) =>
                                rev._id === r._id ? { ...rev, score: Number(e.target.value) } : rev
                              ),
                            }))
                          }
                          className="border p-1 rounded w-16"
                        />
                        <input
                          type="text"
                          value={r.comments}
                          onChange={(e) =>
                            setReviews((prev) => ({
                              ...prev,
                              [p._id]: prev[p._id].map((rev) =>
                                rev._id === r._id ? { ...rev, comments: e.target.value } : rev
                              ),
                            }))
                          }
                          className="border p-1 rounded flex-1"
                        />
                        <button
                          className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                          onClick={() => updateReview(r)}
                        >
                          Update
                        </button>
                        <button
                          className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                          onClick={() => deleteReview(r)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Submit New Review */}
              <div className="mt-2 border-t pt-2 flex space-x-2 items-center">
                <input
                  type="number"
                  min={0}
                  max={10}
                  placeholder="Score"
                  value={newReview[p._id]?.score || ""}
                  onChange={(e) =>
                    setNewReview((prev) => ({
                      ...prev,
                      [p._id]: { ...prev[p._id], score: Number(e.target.value) },
                    }))
                  }
                  className="border p-1 rounded w-16"
                />
                <input
                  type="text"
                  placeholder="Comment"
                  value={newReview[p._id]?.comments || ""}
                  onChange={(e) =>
                    setNewReview((prev) => ({
                      ...prev,
                      [p._id]: { ...prev[p._id], comments: e.target.value },
                    }))
                  }
                  className="border p-1 rounded flex-1"
                />
                <button
                  className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                  onClick={() => submitReview(p._id)}
                  disabled={loading}
                >
                  Submit Review
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
