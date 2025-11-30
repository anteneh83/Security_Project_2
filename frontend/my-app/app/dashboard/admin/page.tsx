"use client";

import { useEffect, useState } from "react";
import useAuth from "@/hooks/useAuth";
import axios from "axios";
import { toast, Toaster } from "react-hot-toast";

interface RoleRequest {
  _id: string;
  requestedRole: string;
  reason: string;
  status: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    role: string;
    department: string;
  };
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  department: string;
}

interface Log {
  _id: string;
  action: string;
  userId?: {
    name: string;
    email: string;
  };
  ip: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const auth = useAuth();
  const [pendingRequests, setPendingRequests] = useState<RoleRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const api = axios.create({
    baseURL: "http://localhost:4000/api",
    headers: auth.getAuthHeaders().headers,
  });

  // Fetch role requests
  const fetchPendingRequests = async () => {
    try {
      const res = await api.get("/admin/roles/requests");
      setPendingRequests(res.data.pending || []);
    } catch {
      toast.error("Failed to load requests");
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data.users || []);
    } catch {
      toast.error("Failed to load users");
    }
  };

  // Fetch logs
  const fetchLogs = async () => {
    if (!["admin", "superadmin", "hr"].includes(auth.role)) return;

    try {
      const res = await api.get("/admin/logs");
      setLogs(res.data.logs || []);
    } catch {
      toast.error("Failed to load logs");
    }
  };

  // Approve request
  const approveRequest = async (id: string) => {
    try {
      await api.post(`/admin/roles/requests/${id}/approve`);
      toast.success("Approved");
      setPendingRequests(prev => prev.filter(req => req._id !== id)); // REMOVE immediately
      fetchUsers();
      fetchLogs();
    } catch {
      toast.error("Failed");
    }
  };

  // Reject request
  const rejectRequest = async (id: string) => {
    try {
      await api.post(`/admin/roles/requests/${id}/reject`);
      toast.success("Rejected");

      setPendingRequests(prev => prev.filter(req => req._id !== id)); // REMOVE immediately
      fetchLogs();
    } catch {
      toast.error("Failed");
    }
  };

  // Assign role directly
  const assignRole = async (userId: string, role: string) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role });
      toast.success("Role updated");
      fetchUsers();
      fetchLogs();
    } catch {
      toast.error("Failed to update role");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchPendingRequests();
      await fetchUsers();
      await fetchLogs();
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="p-8">Loading...</p>;

  return (
    <div className="p-8 space-y-10">
      <Toaster position="top-right" />
      <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
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

      {/* ---------------------- ROLE REQUESTS ---------------------- */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Pending Role Requests</h2>

        {pendingRequests.length === 0 ? (
          <p>No pending requests.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="p-2">User</th>
                <th className="p-2">Email</th>
                <th className="p-2">Current Role</th>
                <th className="p-2">Requested</th>
                <th className="p-2">Reason</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingRequests.map((req) => (
                <tr key={req._id} className="border-b">
                  <td className="p-2">{req.userId.name}</td>
                  <td className="p-2">{req.userId.email}</td>
                  <td className="p-2">{req.userId.role}</td>
                  <td className="p-2">{req.requestedRole}</td>
                  <td className="p-2">{req.reason}</td>
                  <td className="p-2 space-x-2">
                    <button
                      className="bg-green-600 text-white px-2 py-1 rounded"
                      onClick={() => approveRequest(req._id)}
                    >
                      Approve
                    </button>
                    <button
                      className="bg-red-600 text-white px-2 py-1 rounded"
                      onClick={() => rejectRequest(req._id)}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ---------------------- DIRECT ROLE ASSIGNMENT ---------------------- */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Assign Roles Directly</h2>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="p-2">User</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Department</th>
              <th className="p-2">Assign</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-b">
                <td className="p-2">{u.name}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">{u.department}</td>
                <td>
                  <select
                    className="border p-1 rounded"
                    value={u.role}
                    onChange={(e) => assignRole(u._id, e.target.value)}
                  >
                    <option value="author">Author</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="editor">Editor</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ---------------------- LOGS ---------------------- */}
      {["admin", "superadmin", "hr"].includes(auth.role) && (
        <section className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">System Logs</h2>

          {logs.length === 0 ? (
            <p>No logs available.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Action</th>
                  <th className="p-2">User</th>
                  <th className="p-2">IP</th>
                  <th className="p-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className="border-b">
                    <td className="p-2">{log.action}</td>
                    <td className="p-2">
                      {log.userId?.name} ({log.userId?.email})
                    </td>
                    <td className="p-2">{log.ip}</td>
                    <td className="p-2">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
