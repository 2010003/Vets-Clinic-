import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Activity, Plus, Clock, CheckCircle, UserCheck, PlusCircle } from 'lucide-react';
import Modal from '../components/Modal';
import CalendarView from '../components/CalendarView';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, updateDoc, addDoc } from 'firebase/firestore';
import { encryptText } from '../utils/fieldEncryption';

const StaffDashboard = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('appointments');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [filterType, setFilterType] = useState('All');

    // Data State
    const [appointments, setAppointments] = useState([]);
    const [records, setRecords] = useState([]);
    const [allPets, setAllPets] = useState([]);
    const [allClients, setAllClients] = useState([]);
    const [loading, setLoading] = useState(true);

    // Countdown State
    const [nextApptTime, setNextApptTime] = useState(null);
    const [timeLeft, setTimeLeft] = useState('');

    // Modals
    const [isApptModalOpen, setIsApptModalOpen] = useState(false);
    const [isNewRecordModalOpen, setIsNewRecordModalOpen] = useState(false);
    const [isNewApptModalOpen, setIsNewApptModalOpen] = useState(false);

    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [newRecordData, setNewRecordData] = useState({ petId: '', diagnosis: '', notes: '', prescription: '' });
    const [newApptData, setNewApptData] = useState({ clientId: '', petId: '', date: '', time: '', reason: '' });
    const [apptError, setApptError] = useState('');

    const buildMonthlyStats = (recordsList) => {
        const map = {};
        recordsList.forEach(r => {
            if (!r.date) return;
            const key = String(r.date).slice(0, 7); // YYYY-MM
            map[key] = (map[key] || 0) + 1;
        });
        return Object.entries(map).sort(([a], [b]) => (a > b ? 1 : -1));
    };

    // --- 1. Fetch Data ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [apptSnap, recordsSnap, petsSnap, usersSnap] = await Promise.all([
                    getDocs(collection(db, 'appointments')),
                    getDocs(collection(db, 'medical_records')),
                    getDocs(collection(db, 'pets')),
                    getDocs(collection(db, 'users')),
                ]);

                const petsMap = {};
                petsSnap.docs.forEach(d => {
                    petsMap[d.id] = { id: d.id, ...d.data() };
                });

                const usersMap = {};
                const clientsList = [];
                usersSnap.docs.forEach(d => {
                    const userData = { id: d.id, ...d.data() };
                    usersMap[d.id] = userData;
                    if (userData.role === 'client') {
                        clientsList.push(userData);
                    }
                });

                // Store all pets and clients for the booking form
                setAllPets(Object.values(petsMap));
                setAllClients(clientsList);

                const isStaff = user?.role === 'staff';

                let appts = apptSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (isStaff && user?.id) {
                    appts = appts.filter(a => !a.assigned_to || a.assigned_to === user.id);
                }

                const mappedAppts = appts.map(a => {
                    const pet = petsMap[a.pet_id] || {};
                    const ownerUser = usersMap[a.owner_id] || {};
                    const staffUser = a.assigned_to ? usersMap[a.assigned_to] : null;
                    return {
                        ...a,
                        pet: pet.name || 'Unknown',
                        owner: ownerUser.name || 'Unknown',
                        staff: staffUser ? staffUser.name : null,
                        type: a.reason || 'Checkup',
                    };
                });
                setAppointments(mappedAppts);

                const recordsRaw = recordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const mappedRecords = recordsRaw.map(r => {
                    const pet = petsMap[r.pet_id] || {};
                    const ownerUser = pet.owner_id ? usersMap[pet.owner_id] : null;
                    return {
                        ...r,
                        pet: pet.name || `Pet #${r.pet_id}`,
                        owner: ownerUser ? ownerUser.name : 'Unknown',
                    };
                });
                setRecords(mappedRecords);

                setLoading(false);
            } catch (err) {
                console.error('Failed to load dashboard data', err);
                setLoading(false);
            }
        };

        if (user) {
            fetchData();
        }
    }, [user]);

    // --- Helpers ---
    const formatDate = (date) => date.toISOString().split('T')[0];

    // --- Effects (Countdown) ---
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const upcoming = appointments
                .filter(a => a.status === 'Confirmed') // Only count Confirmed ones
                .map(a => ({ ...a, fullDate: new Date(`${a.date}T${a.time}`) }))
                .filter(a => a.fullDate > now)
                .sort((a, b) => a.fullDate - b.fullDate);

            if (upcoming.length > 0) {
                const next = upcoming[0];
                setNextApptTime(next);

                const diff = next.fullDate - now;
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setTimeLeft(`${hours}h ${minutes}m`);
            } else {
                setNextApptTime(null);
                setTimeLeft('');
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [appointments]);

    // --- Handlers ---
    const openApptDetails = (appt) => {
        setSelectedAppointment(appt);
        setIsApptModalOpen(true);
    };

    // ACTION: Assign to Me
    const handleAssignToMe = async () => {
        if (!selectedAppointment || !user) return;
        try {
            const apptRef = doc(db, 'appointments', selectedAppointment.id);
            const snap = await getDoc(apptRef);
            if (!snap.exists()) {
                alert('Appointment not found.');
                return;
            }

            const data = snap.data();
            if (data.assigned_to && data.assigned_to !== user.id && user.role === 'staff') {
                alert('Already assigned to another staff member.');
                return;
            }

            await updateDoc(apptRef, { status: 'Confirmed', assigned_to: user.id });

            const updatedAppts = appointments.map(a =>
                a.id === selectedAppointment.id ? { ...a, status: 'Confirmed', staff: user.name } : a
            );
            setAppointments(updatedAppts);
            setSelectedAppointment(prev => (prev ? { ...prev, status: 'Confirmed', staff: user.name } : prev));

            await addDoc(collection(db, 'audit_logs'), {
                user_email: user.email,
                action: 'APPT_ASSIGN',
                details: `Staff assigned self to appt #${selectedAppointment.id}`,
                timestamp: new Date().toISOString(),
            });

            alert('Appointment Approved & Assigned to you.');
        } catch (err) {
            alert(err.message || 'Failed to assign appointment');
        }
    };

    // ACTION: Mark Done
    const handleMarkAsDone = async () => {
        if (!selectedAppointment || !user) return;

        try {
            const recordPayload = {
                pet_id: selectedAppointment.pet_id,
                date: new Date().toISOString().split('T')[0],
                diagnosis: 'Routine Visit',
                treatment: selectedAppointment.type,
                notes: `Completed appointment for ${selectedAppointment.reason}.`,
                created_by: user.id,
            };

            recordPayload.notes = await encryptText(recordPayload.notes);

            await addDoc(collection(db, 'medical_records'), recordPayload);
            await updateDoc(doc(db, 'appointments', selectedAppointment.id), { status: 'Done' });

            try {
                await addDoc(collection(db, 'audit_logs'), {
                    user_email: user.email,
                    action: 'RECORD_CREATE_AUTO',
                    details: `Auto medical record for appt #${selectedAppointment.id}`,
                    timestamp: new Date().toISOString(),
                });
            } catch (e) {
                console.error('Failed to write medical record audit log', e);
            }

            const updatedAppts = appointments.map(a =>
                a.id === selectedAppointment.id ? { ...a, status: 'Done' } : a
            );
            setAppointments(updatedAppts);

            const newRecordUI = {
                id: Date.now(),
                pet: selectedAppointment.pet,
                owner: selectedAppointment.owner,
                diagnosis: recordPayload.diagnosis,
                date: recordPayload.date,
                treatment: recordPayload.treatment,
            };
            setRecords([newRecordUI, ...records]);

            setIsApptModalOpen(false);
            alert('Appointment completed and record saved.');
        } catch (err) {
            alert('Failed: ' + (err.message || 'Unable to save record'));
        }
    };

    const handleSaveNewRecord = async (e) => {
        e.preventDefault();
        try {
            const encryptedNotes = await encryptText(newRecordData.notes);

            await addDoc(collection(db, 'medical_records'), {
                pet_id: newRecordData.petId,
                date: new Date().toISOString().split('T')[0],
                diagnosis: newRecordData.diagnosis,
                treatment: newRecordData.prescription,
                notes: encryptedNotes,
            });
            try {
                await addDoc(collection(db, 'audit_logs'), {
                    user_email: user?.email || 'unknown',
                    action: 'RECORD_CREATE_MANUAL',
                    details: `Manual medical record for pet #${newRecordData.petId}`,
                    timestamp: new Date().toISOString(),
                });
            } catch (e) {
                console.error('Failed to write manual record audit log', e);
            }
            alert("Record Saved Successfully!");
            setIsNewRecordModalOpen(false);
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    // --- Book Appointment for Client (Auto-approved & Auto-assigned) ---
    const handleBookAppointmentForClient = async (e) => {
        e.preventDefault();
        setApptError('');

        // Validate date is not in the past
        const selectedDate = new Date(newApptData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            setApptError('Cannot book appointments for past dates. Please select a future date.');
            return;
        }

        // Validate client has pets
        const clientPets = allPets.filter(p => p.owner_id === newApptData.clientId);
        if (clientPets.length === 0) {
            setApptError('This client has no pets registered. Please add a pet first.');
            return;
        }

        try {
            // Auto-approved and auto-assigned to current staff
            const appointmentData = {
                pet_id: newApptData.petId,
                owner_id: newApptData.clientId,
                date: newApptData.date,
                time: newApptData.time,
                reason: newApptData.reason,
                status: 'Confirmed', // Auto-approved (no pending status)
                assigned_to: user.id, // Auto-assigned to current staff
                created_by: user.id,
                created_at: new Date().toISOString(),
            };

            const docRef = await addDoc(collection(db, 'appointments'), appointmentData);

            // Log the action
            await addDoc(collection(db, 'audit_logs'), {
                user_email: user.email,
                action: 'APPT_CREATE_AUTO',
                details: `Staff booked & auto-approved appointment #${docRef.id} for client`,
                timestamp: new Date().toISOString(),
            });

            // Update local state
            const pet = allPets.find(p => p.id === newApptData.petId);
            const client = allClients.find(c => c.id === newApptData.clientId);
            
            const newApptUI = {
                id: docRef.id,
                ...appointmentData,
                pet: pet?.name || 'Unknown',
                owner: client?.name || 'Unknown',
                staff: user.name,
                type: newApptData.reason,
            };
            
            setAppointments([...appointments, newApptUI]);
            setIsNewApptModalOpen(false);
            setNewApptData({ clientId: '', petId: '', date: '', time: '', reason: '' });
            
            alert('Appointment booked and confirmed successfully!');
        } catch (err) {
            setApptError('Failed to book appointment: ' + err.message);
        }
    };

    // --- Filter Logic ---
    const selectedDateString = formatDate(selectedDate);
    const dailyAppointments = appointments.filter(a =>
        a.date === selectedDateString &&
        (filterType === 'All' || a.type === filterType)
    );

    if (loading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-50/50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Stats Bar */}
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Clock size={14} /> Upcoming
                            </h3>
                            {nextApptTime ? (
                                <div>
                                    <div className="text-3xl font-bold mb-1">{timeLeft}</div>
                                    <p className="text-slate-300 text-sm">until {nextApptTime.type} with <span className="text-white font-semibold">{nextApptTime.pet}</span></p>
                                </div>
                            ) : (
                                <p className="text-slate-400">No confirmed appointments.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Today's Appointments</p>
                            <h3 className="text-3xl font-bold text-slate-800">{appointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length}</h3>
                        </div>
                        <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><CalendarIcon size={24} /></div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Total Appointments</p>
                            <h3 className="text-3xl font-bold text-slate-800">{appointments.length}</h3>
                        </div>
                        <button 
                            onClick={() => setIsNewApptModalOpen(true)}
                            className="h-12 w-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-md"
                            title="Book New Appointment"
                        >
                            <PlusCircle size={24} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-200 pb-4">
                    <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                        <button onClick={() => setActiveTab('appointments')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'appointments' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}>Calendar & Schedule</button>
                        <button onClick={() => setActiveTab('records')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'records' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}>Medical Records</button>
                    </div>
                    {activeTab === 'records' && (
                        <button onClick={() => setIsNewRecordModalOpen(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200">
                            <Plus size={16} /> New Record
                        </button>
                    )}
                </div>

                {/* --- CALENDAR TAB --- */}
                {activeTab === 'appointments' && (
                    <div className="grid lg:grid-cols-3 gap-8 h-full">
                        <div className="lg:col-span-2">
                            <CalendarView
                                appointments={appointments}
                                selectedDate={selectedDate}
                                onDateSelect={setSelectedDate}
                            />
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[600px]">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-bold text-lg text-slate-800">Schedule</h3>
                                <p className="text-slate-500 text-sm">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {dailyAppointments.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 opacity-60">
                                        <CalendarIcon size={48} strokeWidth={1} />
                                        <p>No appointments.</p>
                                    </div>
                                ) : (
                                    dailyAppointments
                                        .sort((a, b) => a.time.localeCompare(b.time))
                                        .map(appt => (
                                            <div
                                                key={appt.id}
                                                onClick={() => openApptDetails(appt)}
                                                className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${appt.status === 'Done' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm hover:border-emerald-300'}`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold text-slate-800 text-lg">{appt.time}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${appt.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {appt.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-slate-700">{appt.pet}</span>
                                                    <span className="text-xs text-slate-400">({appt.owner})</span>
                                                </div>
                                                {appt.staff && (
                                                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                                        <UserCheck size={12} /> Assigned: {appt.staff}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MEDICAL RECORDS TAB --- */}
                {activeTab === 'records' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-5 border-b border-slate-200 grid md:grid-cols-2 gap-6 bg-slate-50/60">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-2">Monthly Case Volume</h3>
                                {records.length === 0 ? (
                                    <p className="text-xs text-slate-400">No medical records yet.</p>
                                ) : (
                                    (() => {
                                        const monthly = buildMonthlyStats(records);
                                        const max = Math.max(...monthly.map(([, c]) => c), 1);
                                        return (
                                            <div className="space-y-1.5">
                                                {monthly.map(([month, count]) => (
                                                    <div key={month} className="flex items-center gap-3">
                                                        <span className="w-20 text-xs font-mono text-slate-500">{month}</span>
                                                        <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-2.5 bg-emerald-500 rounded-full"
                                                                style={{ width: `${(count / max) * 100}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="w-8 text-[11px] font-semibold text-slate-700 text-right">{count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()
                                )}
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-2">Quick Stats</h3>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700">
                                        <p className="font-semibold">Total Records</p>
                                        <p className="mt-1 text-lg font-bold">{records.length}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-blue-50 text-blue-700">
                                        <p className="font-semibold">Unique Pets</p>
                                        <p className="mt-1 text-lg font-bold">{new Set(records.map(r => r.pet_id || r.pet)).size}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <table className="w-full text-left">
                            <thead className="bg-white text-xs uppercase text-slate-500 font-bold border-b border-slate-200">
                                <tr><th className="p-5">Date</th><th className="p-5">Pet Name</th><th className="p-5">Diagnosis</th><th className="p-5">Treatment</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {records.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="p-5 text-slate-600">{r.date}</td>
                                        <td className="p-5 font-medium text-slate-900">{r.pet} <span className="text-xs font-normal text-slate-400">({r.owner})</span></td>
                                        <td className="p-5"><span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-md text-sm font-medium">{r.diagnosis}</span></td>
                                        <td className="p-5 text-slate-600 text-sm">{r.treatment}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* --- APPOINTMENT DETAILS MODAL --- */}
            <Modal isOpen={isApptModalOpen} onClose={() => setIsApptModalOpen(false)} title="Appointment Details">
                {selectedAppointment && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">🐶</div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">{selectedAppointment.pet}</h3>
                                <p className="text-sm text-slate-500">Owner: {selectedAppointment.owner}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="block text-slate-400 text-xs uppercase font-bold">Date</span> <span className="font-medium">{selectedAppointment.date}</span></div>
                            <div><span className="block text-slate-400 text-xs uppercase font-bold">Time</span> <span className="font-medium">{selectedAppointment.time}</span></div>
                            <div><span className="block text-slate-400 text-xs uppercase font-bold">Reason</span> <span className="font-medium">{selectedAppointment.reason}</span></div>
                            <div><span className="block text-slate-400 text-xs uppercase font-bold">Status</span> <span className={`font-medium ${selectedAppointment.status === 'Pending' ? 'text-amber-600' : 'text-emerald-600'}`}>{selectedAppointment.status}</span></div>
                        </div>

                        {selectedAppointment.staff && (
                            <div className="p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700 flex items-center gap-2">
                                <UserCheck size={14} /> Assigned to: <strong>{selectedAppointment.staff}</strong>
                            </div>
                        )}

                        {/* WORKFLOW BUTTONS */}
                        {selectedAppointment.status === 'Pending' && (
                            <button
                                onClick={handleAssignToMe}
                                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg flex items-center justify-center gap-2"
                            >
                                <UserCheck size={18} /> Approve & Assign to Me
                            </button>
                        )}

                        {selectedAppointment.status === 'Confirmed' && (
                            <button
                                onClick={handleMarkAsDone}
                                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                            >
                                <CheckCircle size={18} /> Mark as Done & Save Record
                            </button>
                        )}
                    </div>
                )}
            </Modal>

            {/* --- NEW RECORD MODAL --- */}
            <Modal isOpen={isNewRecordModalOpen} onClose={() => setIsNewRecordModalOpen(false)} title="Add New Medical Record">
                <form onSubmit={handleSaveNewRecord} className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 mb-2 border border-blue-100">
                        <strong>Note:</strong> Manually entering record.
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Pet ID</label>
                        <input required type="number" className="w-full p-2.5 border rounded-lg outline-none" placeholder="e.g. 1" value={newRecordData.petId} onChange={e => setNewRecordData({ ...newRecordData, petId: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Diagnosis</label>
                        <input required type="text" className="w-full p-2.5 border rounded-lg outline-none" value={newRecordData.diagnosis} onChange={e => setNewRecordData({ ...newRecordData, diagnosis: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Treatment</label>
                        <input required type="text" className="w-full p-2.5 border rounded-lg outline-none" value={newRecordData.prescription} onChange={e => setNewRecordData({ ...newRecordData, prescription: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                        <textarea className="w-full p-2.5 border rounded-lg outline-none" rows="2" value={newRecordData.notes} onChange={e => setNewRecordData({ ...newRecordData, notes: e.target.value })}></textarea>
                    </div>
                    <button className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold">Save</button>
                </form>
            </Modal>

            {/* --- NEW APPOINTMENT MODAL (Staff books for client) --- */}
            <Modal isOpen={isNewApptModalOpen} onClose={() => { setIsNewApptModalOpen(false); setApptError(''); }} title="Book Appointment for Client">
                <form onSubmit={handleBookAppointmentForClient} className="space-y-4">
                    <div className="bg-emerald-50 p-3 rounded-lg text-xs text-emerald-700 mb-2 border border-emerald-100">
                        <strong>Auto-Approved:</strong> Appointments are immediately confirmed and assigned to you.
                    </div>

                    {apptError && (
                        <div className="bg-red-50 p-3 rounded-lg text-sm text-red-700 border border-red-100">
                            {apptError}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Select Client</label>
                        <select 
                            required 
                            className="w-full p-2.5 border rounded-lg bg-white outline-none focus:border-emerald-500"
                            value={newApptData.clientId}
                            onChange={e => {
                                setNewApptData({ ...newApptData, clientId: e.target.value, petId: '' });
                            }}
                        >
                            <option value="">-- Choose a Client --</option>
                            {allClients.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Select Pet</label>
                        <select 
                            required 
                            className="w-full p-2.5 border rounded-lg bg-white outline-none focus:border-emerald-500"
                            value={newApptData.petId}
                            onChange={e => setNewApptData({ ...newApptData, petId: e.target.value })}
                            disabled={!newApptData.clientId}
                        >
                            <option value="">-- Choose a Pet --</option>
                            {allPets
                                .filter(p => p.owner_id === newApptData.clientId)
                                .map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                                ))
                            }
                        </select>
                        {newApptData.clientId && allPets.filter(p => p.owner_id === newApptData.clientId).length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">This client has no pets registered.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                            <input 
                                required 
                                type="date" 
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none" 
                                value={newApptData.date} 
                                onChange={e => setNewApptData({ ...newApptData, date: e.target.value })} 
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Cannot book past dates</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                            <input 
                                required 
                                type="time" 
                                className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none" 
                                value={newApptData.time} 
                                onChange={e => setNewApptData({ ...newApptData, time: e.target.value })} 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Visit</label>
                        <textarea 
                            required 
                            className="w-full p-2.5 border rounded-lg resize-none focus:border-emerald-500 outline-none" 
                            rows="3" 
                            placeholder="Describe symptoms or reason..."
                            value={newApptData.reason}
                            onChange={e => setNewApptData({ ...newApptData, reason: e.target.value })}
                        ></textarea>
                    </div>

                    <button 
                        type="submit"
                        className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={18} /> Book & Confirm Appointment
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default StaffDashboard;