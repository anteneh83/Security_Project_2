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
  filePath: string;
  fileName: string;
}

interface Review {
  _id: string;
  paperId: string;
  score: number;
  comment: string;
}

type ReviewState = {
  [key: string]: Review[] | { error: string };
};

export default function AuthorDashboard() {
  const auth = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activePaperId, setActivePaperId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewState>({});

  const api = axios.create({
    baseURL: "http://localhost:4000/api",
    headers: auth.getAuthHeaders().headers,
  });

  // Fetch papers
  const fetchPapers = async () => {
    try {
      const res = await api.get("/papers/");
      const formatted = res.data.map((p: any) => ({
        _id: p._id,
        title: p.title,
        abstract: p.abstract,
        keywords: p.keywords,
        department: p.department,
        filePath: p.filePath,
        fileName: p.filePath?.split("/").pop() || "paper.pdf",
        status: p.status,
        createdAt: p.createdAt,
      }));
      setPapers(formatted);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to fetch papers");
    }
  };

  useEffect(() => {
    fetchPapers();
  }, []);

  // Submit or update paper
  const submitPaper = async () => {
    if (!title || !abstract || !keywords || !department) {
      return toast.error("All fields except file are required.");
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("abstract", abstract);
    formData.append("keywords", keywords);
    formData.append("department", department);
    if (selectedFile) formData.append("paper", selectedFile);

    setLoading(true);
    try {
      if (editingPaperId) {
        const updateData = new FormData();
        updateData.append("title", title);
        updateData.append("abstract", abstract);
        updateData.append("keywords", keywords);
        updateData.append("department", department);

        // Only include paper file if user selected a new one
        if (selectedFile) {
          updateData.append("paper", selectedFile);
        }

        await api.put(`/papers/${editingPaperId}`, updateData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        toast.success("Paper updated successfully");
      } else {
        // Submit new paper
        await api.post("/papers/", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Paper submitted successfully");
      }

      setTitle("");
      setAbstract("");
      setKeywords("");
      setDepartment("");
      setSelectedFile(null);
      setEditingPaperId(null);
      fetchPapers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to submit/update paper");
    } finally {
      setLoading(false);
    }
  };

  // Delete paper
  const deletePaper = async (id: string) => {
    if (!id) return toast.error("Paper ID is missing");
    
    if (!confirm("Are you sure you want to delete this paper?")) return;
    try {
      await api.delete(`/papers/${id}`);
      toast.success("Paper deleted");
      fetchPapers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete paper");
    }
  };

  // Download paper
  const downloadPaper = async (id: string, filePath: string) => {
    if (!id) return toast.error("Paper ID is missing");
    const fileName = filePath.split("/").pop() || "paper.pdf";
    try {
      const res = await api.get(`/papers/${id}/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to download file");
    }
  };

const fetchReviews = async (paperId: string) => {
  if (!paperId) return;

  try {
    const res = await api.get(`/reviews/paper/${paperId}`);

    setReviews((prev) => ({
      ...prev,
      [paperId]: res.data.reviews ?? [],
    }));
  } catch (error: any) {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;

    let errorText = "Failed to fetch reviews.";

    if (status === 403) {
      if (message?.toLowerCase().includes("clearance")) {
        errorText = "Access denied: MAC policy restricts your clearance level.";
      } else if (message?.toLowerCase().includes("department")) {
        errorText = "Access denied: ABAC department rule prevents viewing this review.";
      }
    } else if (status === 401) {
      errorText = "Unauthorized: Please log in again.";
    }

    setReviews((prev) => ({
      ...prev,
      [paperId]: { error: errorText },
    }));
  }
};



  // Edit paper
  const editPaper = (paper: Paper) => {
    setEditingPaperId(paper._id);
    setTitle(paper.title);
    setAbstract(paper.abstract);
    setKeywords(paper.keywords.join(", "));
    setDepartment(paper.department);
    toast("Editing mode activated", { icon: "✏️" });
  };

  return (
    <div className="p-8 space-y-6">
      <Toaster position="top-right" />
      <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold">Author Dashboard</h1>
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
    
      {/* Submit / Update */}
      <section className="bg-white p-4 rounded shadow space-y-2">
        <h2 className="text-xl font-semibold">{editingPaperId ? "Edit Paper" : "Submit New Paper"}</h2>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <textarea
          placeholder="Abstract"
          value={abstract}
          onChange={(e) => setAbstract(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <input
          type="text"
          placeholder="Keywords (comma separated)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <input
          type="text"
          placeholder="Department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          className="border p-2 rounded w-full"
        />
        <button
          onClick={submitPaper}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {loading ? (editingPaperId ? "Updating..." : "Submitting...") : editingPaperId ? "Update Paper" : "Submit Paper"}
        </button>
      </section>

      {/* Papers list */}
      <section className="bg-white p-4 rounded shadow space-y-2">
        <h2 className="text-xl font-semibold">Papers</h2>
        {papers.length === 0 ? (
          <p>No papers submitted yet.</p>
        ) : (
          <div className="space-y-2">
            {papers.map((p) => (
              <div
                key={p._id}
                className="border p-2 rounded flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0"
              >
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-gray-600">{p.abstract}</p>
                  <p className="text-sm text-gray-500">Keywords: {p.keywords}</p>
                  <p className="text-sm text-gray-500">Department: {p.department}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => downloadPaper(p._id, p.filePath)}
                    className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={() => editPaper(p)}
                    className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deletePaper(p._id)}
                    className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => {
                      setActivePaperId(p._id);
                      fetchReviews(p._id);
                      setShowReviewModal(true);
                    }}
                    className="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700"
                  >
                    View Reviews
                  </button>

                </div>

                
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Review Modal */}
      {showReviewModal && activePaperId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md relative">

            {/* Close Button */}
            <button
              className="absolute top-2 right-2 text-gray-600 hover:text-black"
              onClick={() => {
                setShowReviewModal(false);
                setActivePaperId(null);
              }}
            >
              ✖
            </button>

            <h2 className="text-xl font-semibold mb-4">Reviews</h2>

            {/* Review Content */}
              {!reviews[activePaperId] ? (
                <p className="text-gray-600 text-sm">Loading...</p>
                ) : "error" in (reviews[activePaperId] as any) ? (
                  <p className="text-red-600 font-medium">
                    {(reviews[activePaperId] as any).error}
                  </p>
                ) : (reviews[activePaperId] as Review[]).length === 0 ? (
                  <p className="text-gray-600">No reviews yet for this paper.</p>
                ) : (
                  <div className="space-y-3">
                    {(reviews[activePaperId] as Review[]).map((rev) => (
                      <div key={rev._id} className="border p-2 rounded">
                        <p><strong>Score:</strong> {rev.score}</p>
                        <p><strong>Comment:</strong> {rev.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

          </div>
        </div>
      )}

    </div>
  );
}
