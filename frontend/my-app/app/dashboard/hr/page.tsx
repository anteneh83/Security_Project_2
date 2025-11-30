"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import useAuth from "@/hooks/useAuth";
import { toast, Toaster } from "react-hot-toast";

interface RoleLog {
  _id: string;
  action: string;
  userId: {
    _id: string;
    name: string;
  };
  targetUserId?: {
    _id: string;
    name: string;
  };
  timestamp: string;
  details: any;
}

export default function RoleRequestForm() {
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [reason, setReason] = useState("");
  const [logs, setLogs] = useState<RoleLog[]>([]);

  const api = axios.create({
    baseURL: "http://localhost:4000/api",
    headers: auth.getAuthHeaders().headers,
  });

  // Submit new role request
  const submitRequest = async () => {
    if (!newRole) return toast.error("Please select a role");
    setLoading(true);
    try {
      await api.post("/admin/roles/request", { requestedRole: newRole, reason });
      toast.success("Role change request submitted");
      setNewRole("");
      setReason("");
      fetchLogs(); // refresh logs after submission
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  // Fetch logs for the current user
  const fetchLogs = async () => {
    try {
      const res = await api.get("/admin/logs", {
        params: { userId: auth.user?._id }, // only fetch logs for the current user
      });
      setLogs(res.data.logs || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to fetch logs");
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="p-8 space-y-6 max-w-2xl mx-auto">
      <Toaster position="top-right" />
      <h1 className="text-3xl font-bold">Request Role Change</h1>
      <p className="mt-2 text-gray-600">
        Submit a request to change your role and view your activity logs.
      </p>

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

      {/* User Logs */}
      <section className="bg-white p-4 rounded shadow space-y-4">
        <h2 className="text-xl font-semibold">My Activity Logs</h2>
        {logs.length === 0 ? (
          <p>No logs available.</p>
        ) : (
          logs.map((log) => (
            <div key={log._id} className="border p-2 rounded">
              <p>
                <span className="font-semibold">{log.userId?.name}</span> performed{" "}
                <span className="font-semibold">{log.action}</span>
              </p>
              <p className="text-sm text-gray-500">
                {new Date(log.timestamp).toLocaleString()}
              </p>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
