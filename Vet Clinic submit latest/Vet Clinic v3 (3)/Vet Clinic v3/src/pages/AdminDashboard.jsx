import { useState, useEffect } from 'react';
import { Users, Key, RefreshCw, Activity, AlertTriangle, CheckCircle, Lock as LockIcon, Trash2, Edit, UserPlus, BarChart3 } from 'lucide-react';
import Modal from '../components/Modal';
import { db } from '../firebase';
import { collection, doc, getDocs, updateDoc, addDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('users');

    // Data States
    const [users, setUsers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [requests, setRequests] = useState([]);
    const [reportRecords, setReportRecords] = useState([]);
    const [reportAppointments, setReportAppointments] = useState([]);

    // Modal States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Form States
    const [editingUser, setEditingUser] = useState(null);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'staff', phone: '' });

    // Loading & Error States
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Stats
    const stats = {
        totalUsers: users.length,
        totalRequests: requests.length, // Now shows all auto-approved requests
        recentLogs: logs.length
    };

    const buildMonthlyStats = (records) => {
        const map = {};
        records.forEach(r => {
            if (!r.date) return;
            const key = String(r.date).slice(0, 7); // YYYY-MM
            map[key] = (map[key] || 0) + 1;
        });
        return Object.entries(map).sort(([a], [b]) => (a > b ? 1 : -1));
    };

    const exportCsv = (rows, columns, filename) => {
        if (!rows || rows.length === 0) {
            alert('No data to export.');
            return;
        }
        const header = columns.map(c => c.label).join(',');
        const body = rows.map(row =>
            columns
                .map(c => {
                    const val = row[c.key] ?? '';
                    const asString = typeof val === 'string' ? val : String(val);
                    // Escape quotes and wrap in quotes
                    return '"' + asString.replace(/"/g, '""') + '"';
                })
                .join(',')
        );
        const csv = [header, ...body].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                if (activeTab === 'users') {
                    const snap = await getDocs(collection(db, 'users'));
                    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (isMounted) setUsers(data);
                } else if (activeTab === 'logs') {
                    const logsRef = collection(db, 'audit_logs');
                    const q = query(logsRef, orderBy('timestamp', 'desc'));
                    const snap = await getDocs(q);
                    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (isMounted) setLogs(data);
                } else if (activeTab === 'requests') {
                    // Show all password reset requests (they are auto-approved now)
                    const reqRef = collection(db, 'password_requests');
                    const q = query(reqRef, orderBy('request_date', 'desc'));
                    const snap = await getDocs(q);
                    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (isMounted) setRequests(data);
                } else if (activeTab === 'reports') {
                    const recordsSnap = await getDocs(collection(db, 'medical_records'));
                    const apptSnap = await getDocs(collection(db, 'appointments'));
                    if (isMounted) {
                        setReportRecords(recordsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                        setReportAppointments(apptSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                    }
                }
            } catch (err) {
                console.error("Admin Fetch Error:", err);
                if (isMounted) setError("Failed to load data. Check your connection and permissions.");
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchData();

        return () => { isMounted = false; };
    }, [activeTab]);

    // --- ACTIONS ---

    const handleResolve = async (id) => {
        try {
            const ref = doc(db, 'password_requests', id);
            await updateDoc(ref, { status: 'Resolved' });
            setRequests(prev => prev.filter(r => r.id !== id));
            alert("Request resolved successfully.");
        } catch (err) {
            alert("Failed to resolve request.");
        }
    };

    // EDIT USER
    const handleEditClick = (user) => {
        setEditingUser({ ...user });
        setIsEditModalOpen(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        try {
            const ref = doc(db, 'users', editingUser.id);
            await updateDoc(ref, {
                name: editingUser.name,
                email: editingUser.email,
                role: editingUser.role,
                phone: editingUser.phone || '',
            });
            setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
            setIsEditModalOpen(false);
            alert("User updated successfully.");
        } catch (err) {
            alert("Update failed: " + err.message);
        }
    };

    // CREATE USER
    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            // In the Firebase-only version, staff/admin accounts
            // are created when a user self-registers and is then
            // promoted by an admin. Here we locate the existing
            // user by email and update their role and profile.
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', newUser.email));
            const snap = await getDocs(q);

            if (snap.empty) {
                alert('No existing account found for this email. Ask the user to register first.');
                return;
            }

            const target = snap.docs[0];
            await updateDoc(target.ref, {
                name: newUser.name,
                phone: newUser.phone || '',
                role: newUser.role,
            });

            const refreshed = await getDocs(collection(db, 'users'));
            setUsers(refreshed.docs.map(d => ({ id: d.id, ...d.data() })));

            setIsCreateModalOpen(false);
            setNewUser({ name: '', email: '', password: '', role: 'staff', phone: '' }); // Reset form
            alert("User created successfully!");
        } catch (err) {
            alert("Failed to create user: " + err.message);
        }
    };

    // DELETE USER
    const handleDeleteUser = async (id) => {
        if (!window.confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
        try {
            await deleteDoc(doc(db, 'users', id));
            setUsers(users.filter(u => u.id !== id));
        } catch (err) {
            alert("Delete failed: " + err.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header & Stats */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Control Center</h1>
                        <p className="text-slate-500 mt-1">Manage system security and personnel.</p>
                    </div>

                    {/* NEW: Create Staff Button */}
                    {activeTab === 'users' && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2"
                        >
                            <UserPlus size={18} /> Create New Staff
                        </button>
                    )}
                </div>

                {/* Stats Cards */}
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users size={24} /></div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Users</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.totalUsers || '-'}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Key size={24} /></div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Password Resets</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.totalRequests || '-'}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Activity size={24} /></div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">System Status</p>
                            <h3 className="text-2xl font-bold text-emerald-600">Secure</h3>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
                    <button onClick={() => setActiveTab('users')} className={`px-6 py-3 rounded-t-xl font-medium text-sm transition-colors duration-200 ${activeTab === 'users' ? 'bg-white text-emerald-600 border-b-2 border-emerald-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60 border-b-2 border-transparent'}`}>User Management</button>
                    <button onClick={() => setActiveTab('requests')} className={`px-6 py-3 rounded-t-xl font-medium text-sm transition-colors duration-200 flex items-center gap-2 ${activeTab === 'requests' ? 'bg-white text-emerald-600 border-b-2 border-emerald-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60 border-b-2 border-transparent'}`}>
                        Password Reset Log
                    </button>
                    <button onClick={() => setActiveTab('logs')} className={`px-6 py-3 rounded-t-xl font-medium text-sm transition-colors duration-200 ${activeTab === 'logs' ? 'bg-white text-emerald-600 border-b-2 border-emerald-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60 border-b-2 border-transparent'}`}>Audit Logs</button>
                    <button onClick={() => setActiveTab('reports')} className={`px-6 py-3 rounded-t-xl font-medium text-sm transition-colors duration-200 flex items-center gap-2 ${activeTab === 'reports' ? 'bg-white text-emerald-600 border-b-2 border-emerald-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60 border-b-2 border-transparent'}`}>
                        <BarChart3 size={16} /> Reports
                    </button>
                </div>

                {/* Content Area */}
                <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-sm border border-slate-200 min-h-[400px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <p>Loading secure data...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-64 text-red-500 p-6 text-center">
                            <AlertTriangle size={32} className="mb-2" />
                            <p>{error}</p>
                            <p className="text-sm text-slate-400 mt-2">Check server console for details.</p>
                        </div>
                    ) : (
                        <div className="p-0">
                            {/* --- USERS TABLE --- */}
                            {activeTab === 'users' && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b border-slate-100">
                                            <tr><th className="p-6">User</th><th className="p-6">Role</th><th className="p-6">Security Status</th><th className="p-6 text-right">Actions</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {users.map(u => (
                                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-6">
                                                        <div className="font-bold text-slate-800">{u.name}</div>
                                                        <div className="text-sm text-slate-500">{u.email}</div>
                                                    </td>
                                                    <td className="p-6">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                    <td className="p-6">
                                                        {u.two_factor_enabled ?
                                                            <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium"><CheckCircle size={14} /> 2FA Enabled</span> :
                                                            <span className="flex items-center gap-1.5 text-slate-400 text-sm"><LockIcon size={14} /> Standard</span>
                                                        }
                                                    </td>
                                                    <td className="p-6 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => handleEditClick(u)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit size={16} /></button>
                                                            <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* --- PASSWORD REQUESTS --- */}
                            {activeTab === 'requests' && (
                                <div>
                                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 m-6 text-sm text-emerald-700">
                                        <strong>Auto-Approved System:</strong> Password reset requests are now handled automatically. Firebase sends reset emails instantly when users submit requests. This log shows recent reset activity.
                                    </div>
                                    {requests.length === 0 ? (
                                        <div className="text-center py-20 text-slate-400">
                                            <CheckCircle size={40} className="mx-auto mb-3 text-slate-300" />
                                            <p>All password resets are processed automatically by the system.</p>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left">
                                            <thead className="bg-emerald-50 text-xs uppercase text-emerald-800 font-bold border-b border-emerald-100">
                                                <tr><th className="p-6">User Email</th><th className="p-6">Requested</th><th className="p-6">Status</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {requests.map(r => (
                                                    <tr key={r.id} className="hover:bg-slate-50">
                                                        <td className="p-6 font-medium text-slate-700">{r.email}</td>
                                                        <td className="p-6 text-sm text-slate-500">{new Date(r.request_date).toLocaleDateString()}</td>
                                                        <td className="p-6">
                                                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                                                                {r.status === 'Auto-Approved' ? 'Auto-Approved' : r.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}

                            {/* --- AUDIT LOGS --- */}
                            {activeTab === 'logs' && (
                                <div className="p-2">
                                    <div className="overflow-hidden rounded-xl border border-slate-200">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-100 text-xs uppercase text-slate-500 font-bold">
                                                <tr><th className="p-4 pl-6">Timestamp</th><th className="p-4">User</th><th className="p-4">Event</th><th className="p-4">Details</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {logs.map(l => (
                                                    <tr key={l.id} className="hover:bg-slate-50 text-sm font-mono">
                                                        <td className="p-4 pl-6 text-slate-400">{new Date(l.timestamp).toLocaleString()}</td>
                                                        <td className="p-4 text-emerald-700">{l.user_email}</td>
                                                        <td className="p-4 font-bold text-slate-700">{l.action}</td>
                                                        <td className="p-4 text-slate-500">{l.details}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* --- REPORTS (MEDICAL HISTORY & APPOINTMENTS) --- */}
                            {activeTab === 'reports' && (
                                <div className="p-6 space-y-8">
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between">
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Total Appointments</p>
                                                <p className="mt-1 text-2xl font-bold text-slate-900">{reportAppointments.length}</p>
                                            </div>
                                            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Activity size={20} /></div>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between">
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Medical Records</p>
                                                <p className="mt-1 text-2xl font-bold text-slate-900">{reportRecords.length}</p>
                                            </div>
                                            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><BarChart3 size={20} /></div>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between">
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Today&apos;s Appointments</p>
                                                <p className="mt-1 text-2xl font-bold text-slate-900">{reportAppointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length}</p>
                                            </div>
                                            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Activity size={20} /></div>
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Medical Records by Month</h3>
                                            {reportRecords.length === 0 ? (
                                                <p className="text-sm text-slate-400">No medical records yet.</p>
                                            ) : (
                                                (() => {
                                                    const monthly = buildMonthlyStats(reportRecords);
                                                    const max = Math.max(...monthly.map(([, c]) => c), 1);
                                                    return (
                                                        <div className="space-y-2">
                                                            {monthly.map(([month, count]) => (
                                                                <div key={month} className="flex items-center gap-3">
                                                                    <span className="w-20 text-xs font-mono text-slate-500">{month}</span>
                                                                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-3 bg-emerald-500 rounded-full"
                                                                            style={{ width: `${(count / max) * 100}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="w-8 text-xs font-semibold text-slate-700 text-right">{count}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()
                                            )}
                                        </div>

                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Appointments by Status</h3>
                                            {reportAppointments.length === 0 ? (
                                                <p className="text-sm text-slate-400">No appointments recorded.</p>
                                            ) : (
                                                <div className="space-y-2 text-sm">
                                                    {['Pending', 'Confirmed', 'Done'].map(status => {
                                                        const count = reportAppointments.filter(a => a.status === status).length;
                                                        if (count === 0) return null;
                                                        const max = Math.max(...['Pending', 'Confirmed', 'Done'].map(s => reportAppointments.filter(a => a.status === s).length), 1);
                                                        return (
                                                            <div key={status} className="flex items-center gap-3">
                                                                <span className="w-24 text-xs font-semibold text-slate-600">{status}</span>
                                                                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-3 rounded-full ${status === 'Done' ? 'bg-emerald-500' : status === 'Confirmed' ? 'bg-blue-500' : 'bg-amber-400'}`}
                                                                        style={{ width: `${(count / max) * 100}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="w-8 text-xs font-semibold text-slate-700 text-right">{count}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200 mt-4">
                                        <button
                                            onClick={() => exportCsv(
                                                reportAppointments,
                                                [
                                                    { key: 'date', label: 'Date' },
                                                    { key: 'time', label: 'Time' },
                                                    { key: 'pet_id', label: 'Pet ID' },
                                                    { key: 'owner_id', label: 'Owner ID' },
                                                    { key: 'status', label: 'Status' },
                                                    { key: 'reason', label: 'Reason' },
                                                ],
                                                'appointments_report.csv'
                                            )}
                                            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                        >
                                            Export Appointments (CSV)
                                        </button>
                                        <button
                                            onClick={() => exportCsv(
                                                reportRecords,
                                                [
                                                    { key: 'date', label: 'Date' },
                                                    { key: 'pet_id', label: 'Pet ID' },
                                                    { key: 'diagnosis', label: 'Diagnosis' },
                                                    { key: 'treatment', label: 'Treatment' },
                                                    { key: 'created_by', label: 'Created By' },
                                                ],
                                                'medical_records_report.csv'
                                            )}
                                            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                        >
                                            Export Medical Records (CSV)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* EDIT USER MODAL */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit User">
                {editingUser && (
                    <form onSubmit={handleSaveUser} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                            <input type="text" className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none" value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input type="text" disabled className="w-full p-2.5 border rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed" value={editingUser.email} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                            <select className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none bg-white" value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}>
                                <option value="client">Client</option>
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                            <input type="text" className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none" value={editingUser.phone || ''} onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })} />
                        </div>
                        <div className="pt-2 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-medium">Save Changes</button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* CREATE USER MODAL */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Account">
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 border border-blue-100">
                        <strong>Security Note:</strong> You are creating a privileged account. Please ensure the password is communicated securely.
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                            <input required type="text" className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none" placeholder="Full Name" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                            <select className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none bg-white" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                                <option value="client">Client</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input required type="email" className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none" placeholder="email@vet.com" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
                        <input required type="password" className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none" placeholder="********" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone (Optional)</label>
                        <input type="tel" className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none" placeholder="+60..." value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} />
                    </div>
                    <div className="pt-2 flex justify-end gap-3">
                        <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium shadow-md shadow-emerald-200">Create Account</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default AdminDashboard;