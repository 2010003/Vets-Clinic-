import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, Activity, PlusCircle, Heart, TrendingUp, PawPrint, Save } from 'lucide-react';
import Modal from '../components/Modal';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';

const ClientPortal = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('pets');

    const [pets, setPets] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isAddPetOpen, setIsAddPetOpen] = useState(false);
    const [isPetModalOpen, setIsPetModalOpen] = useState(false);

    const [selectedPetForView, setSelectedPetForView] = useState(null);

    const [newPet, setNewPet] = useState({ name: '', type: 'Dog', breed: '', age: '', weight: '' });

    useEffect(() => {
        if (!user) return;

        const fetchClientData = async () => {
            setLoading(true);
            try {
                // Load pets for this owner
                const petsQ = query(collection(db, 'pets'), where('owner_id', '==', user.id));
                const petsSnap = await getDocs(petsQ);
                const petsData = petsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setPets(petsData);

                // Load users map (to resolve assigned staff names)
                const usersSnap = await getDocs(collection(db, 'users'));
                const usersMap = {};
                usersSnap.docs.forEach(d => {
                    usersMap[d.id] = { id: d.id, ...d.data() };
                });

                // Load appointments for this owner
                const apptQ = query(collection(db, 'appointments'), where('owner_id', '==', user.id));
                const apptSnap = await getDocs(apptQ);
                const petMap = {};
                petsData.forEach(p => { petMap[p.id] = p; });

                const apptData = apptSnap.docs.map(d => {
                    const raw = { id: d.id, ...d.data() };
                    const staffUser = raw.assigned_to ? usersMap[raw.assigned_to] : null;
                    return {
                        ...raw,
                        pet_name: petMap[raw.pet_id]?.name || 'Unknown',
                        staff_name: staffUser ? staffUser.name : null,
                    };
                });
                setAppointments(apptData);

                // Load medical records visible to this client (via their pets)
                const petsMap = {};
                petsData.forEach(p => { petsMap[p.id] = p; });
                const recordsSnap = await getDocs(collection(db, 'medical_records'));
                const recordsRaw = recordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const filteredRecords = recordsRaw.filter(r => {
                    const pet = petsMap[r.pet_id];
                    return pet && pet.owner_id === user.id;
                }).map(r => {
                    const pet = petsMap[r.pet_id];
                    return {
                        ...r,
                        pet_name: pet?.name || `Pet #${r.pet_id}`,
                    };
                });
                setRecords(filteredRecords);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchClientData();
    }, [user]);

    const formatAgeDisplay = (ageVal) => {
        if (!ageVal) return <span className="text-slate-400">-</span>;
        const num = parseFloat(ageVal);
        if (isNaN(num)) return <span className="text-slate-400">-</span>;

        if (num > 0 && num < 1) {
            const months = Math.round(num * 12);
            return <><span className="font-semibold text-slate-700">{months}</span> <span className="text-xs text-slate-400">mths</span></>;
        }
        return <><span className="font-semibold text-slate-700">{ageVal}</span> <span className="text-xs text-slate-400">yrs</span></>;
    };

    const formatWeightDisplay = (weightVal) => {
        if (!weightVal) return <span className="text-slate-400">-</span>;
        return <><span className="font-semibold text-slate-700">{weightVal}</span> <span className="text-xs text-slate-400">kg</span></>;
    }


    const handleAddPet = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...newPet,
                age: newPet.age ? parseFloat(newPet.age) : null,
                weight: newPet.weight ? parseFloat(newPet.weight) : null,
                owner_id: user.id,
            };

            await addDoc(collection(db, 'pets'), payload);
            alert("Pet added successfully!");
            setIsAddPetOpen(false);
            setNewPet({ name: '', type: 'Dog', breed: '', age: '', weight: '' });
            // Reload pets
            const petsQ = query(collection(db, 'pets'), where('owner_id', '==', user.id));
            const petsSnap = await getDocs(petsQ);
            const petsData = petsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setPets(petsData);
        } catch (err) {
            alert(err.message);
        }
    };

    const handleViewPet = (pet) => {
        setSelectedPetForView(pet);
        setIsPetModalOpen(true);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading portal...</div>;

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome, {user?.name.split(' ')[0]} 👋</h1>
                    <p className="text-slate-500 mt-1">Manage your pets and healthcare.</p>
                </div>

                <div className="grid lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xl shadow-inner">
                                    {user?.name.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-800 leading-tight">{user?.name}</h2>
                                    <p className="text-xs text-slate-500">Client Account</p>
                                </div>
                            </div>
                            <div className="space-y-3 pt-4 border-t border-slate-100">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Total Pets</span>
                                    <span className="font-semibold text-slate-900">{pets.length}</span>
                                </div>
                            </div>
                        </div>

                        <nav className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <button onClick={() => setActiveTab('pets')} className={`w-full text-left p-4 flex items-center gap-3 transition-all ${activeTab === 'pets' ? 'bg-emerald-50 text-emerald-700 font-semibold border-r-4 border-emerald-500' : 'text-slate-600 hover:bg-slate-50'}`}>
                                <Activity size={18} /> My Pets
                            </button>
                            <button onClick={() => setActiveTab('appointments')} className={`w-full text-left p-4 flex items-center gap-3 transition-all ${activeTab === 'appointments' ? 'bg-emerald-50 text-emerald-700 font-semibold border-r-4 border-emerald-500' : 'text-slate-600 hover:bg-slate-50'}`}>
                                <Calendar size={18} /> Appointments
                            </button>
                            <button onClick={() => setActiveTab('records')} className={`w-full text-left p-4 flex items-center gap-3 transition-all ${activeTab === 'records' ? 'bg-emerald-50 text-emerald-700 font-semibold border-r-4 border-emerald-500' : 'text-slate-600 hover:bg-slate-50'}`}>
                                <Clock size={18} /> Medical History
                            </button>
                        </nav>
                    </div>

                    <div className="lg:col-span-9">

                        {activeTab === 'pets' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-slate-800">My Pets</h2>
                                    <button
                                        onClick={() => setIsAddPetOpen(true)}
                                        className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-full font-medium shadow-lg hover:bg-slate-800 transition-all hover:scale-105"
                                    >
                                        <PlusCircle size={18} /> Add New Pet
                                    </button>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    {pets.length === 0 && (
                                        <div className="col-span-2 text-center py-10 bg-white rounded-2xl border border-dashed border-slate-300">
                                            <PawPrint size={48} className="mx-auto text-slate-300 mb-2" />
                                            <p className="text-slate-500">No pets registered yet. Add one to get started!</p>
                                        </div>
                                    )}
                                    {pets.map(pet => (
                                        <div key={pet.id} className="group bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl hover:border-emerald-100 transition-all duration-300">
                                            <div className="h-24 bg-gradient-to-r from-emerald-50 to-teal-50 relative">
                                                <div className="absolute -bottom-8 left-6">
                                                    <div className="w-20 h-20 bg-white rounded-2xl p-1 shadow-md">
                                                        <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center text-3xl">
                                                            {pet.type === 'Dog' ? '🐶' : pet.type === 'Cat' ? '🐱' : '🐾'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-10 px-6 pb-6">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="text-2xl font-bold text-slate-800">{pet.name}</h3>
                                                        <p className="text-slate-500 font-medium">{pet.breed || 'Mixed Breed'}</p>
                                                    </div>
                                                    <button onClick={() => handleViewPet(pet)} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold hover:bg-emerald-100 transition-colors">
                                                        <Activity size={16} /> Details
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 py-4 border-t border-slate-100">
                                                    <div className="text-center p-2 bg-slate-50 rounded-xl">
                                                        <span className="block text-xs text-slate-400 font-bold mb-1">Age</span>
                                                        {formatAgeDisplay(pet.age)}
                                                    </div>
                                                    <div className="text-center p-2 bg-slate-50 rounded-xl">
                                                        <span className="block text-xs text-slate-400 font-bold mb-1">Weight</span>
                                                        {formatWeightDisplay(pet.weight)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'appointments' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-slate-800">Your Appointments</h2>
                                    <p className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">Appointments are scheduled by staff</p>
                                </div>

                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-3">
                                    <Calendar size={20} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                    <span>To schedule an appointment, please contact the clinic. Staff will book your appointment and you can view it here.</span>
                                </div>

                                <div className="grid gap-4">
                                    {appointments.length === 0 && <p className="text-slate-500 text-center py-8">No appointments scheduled.</p>}
                                    {appointments.map(app => (
                                        <div key={app.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-6 w-full">
                                                <div className="bg-slate-50 p-4 rounded-2xl text-center min-w-[80px] border border-slate-100">
                                                    <span className="block text-xs text-slate-400 uppercase font-bold tracking-wider">DATE</span>
                                                    <span className="block text-lg font-bold text-slate-800">{app.date}</span>
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-lg">{app.reason || 'Checkup'}</h3>
                                                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                                        <span className="flex items-center gap-1.5"><Clock size={14} className="text-emerald-500" /> {app.time}</span>
                                                        <span className="flex items-center gap-1.5"><Heart size={14} className="text-rose-500" /> {app.pet_name}</span>
                                                    </div>
                                                    {app.staff_name && (
                                                        <div className="text-xs text-blue-600 bg-blue-50 inline-flex items-center gap-1 px-2 py-0.5 rounded mt-2 font-medium">
                                                            👨‍⚕️ Assigned to: {app.staff_name}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${app.status === 'Confirmed' || app.status === 'Done' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {app.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'records' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-slate-800">Medical History</h2>
                                    <p className="text-xs text-slate-400">Only visits recorded by clinic staff are shown here.</p>
                                </div>

                                {records.length === 0 ? (
                                    <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-10 text-center text-slate-500">
                                        No medical records yet. Your pet's treatments will appear here after visits.
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="p-4">Date</th>
                                                    <th className="p-4">Pet</th>
                                                    <th className="p-4">Diagnosis</th>
                                                    <th className="p-4">Treatment</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {records.map(r => (
                                                    <tr key={r.id} className="hover:bg-slate-50">
                                                        <td className="p-4 text-sm text-slate-600">{r.date}</td>
                                                        <td className="p-4 text-sm font-medium text-slate-900">{r.pet_name}</td>
                                                        <td className="p-4 text-sm"><span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium text-xs">{r.diagnosis}</span></td>
                                                        <td className="p-4 text-sm text-slate-600">{r.treatment}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal isOpen={isAddPetOpen} onClose={() => setIsAddPetOpen(false)} title="Register New Pet">
                <form onSubmit={handleAddPet} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Pet Name</label>
                            <input required type="text" className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none" placeholder="e.g. Buster" value={newPet.name} onChange={e => setNewPet({ ...newPet, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                            <select className="w-full p-2.5 border rounded-lg bg-white outline-none focus:border-emerald-500" value={newPet.type} onChange={e => setNewPet({ ...newPet, type: e.target.value })}>
                                <option>Dog</option>
                                <option>Cat</option>
                                <option>Bird</option>
                                <option>Rabbit</option>
                                <option>Other</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Breed</label>
                        <input type="text" className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none" placeholder="e.g. Golden Retriever" value={newPet.breed} onChange={e => setNewPet({ ...newPet, breed: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Age (Years)</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                required
                                className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none"
                                placeholder="e.g. 2.5"
                                value={newPet.age}
                                onChange={e => setNewPet({ ...newPet, age: e.target.value })}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Use decimals for months (e.g. 0.5 = 6mths)</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Weight (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                required
                                className="w-full p-2.5 border rounded-lg focus:border-emerald-500 outline-none"
                                placeholder="e.g. 5.4"
                                value={newPet.weight}
                                onChange={e => setNewPet({ ...newPet, weight: e.target.value })}
                            />
                        </div>
                    </div>
                    <button className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 mt-2">
                        <Save size={18} /> Save Pet Profile
                    </button>
                </form>
            </Modal>

            <Modal isOpen={isPetModalOpen} onClose={() => setIsPetModalOpen(false)} title="Health Dashboard">
                {selectedPetForView && (
                    <div className="space-y-8">
                        <div className="flex items-center gap-5">
                            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center text-4xl shadow-inner">
                                {selectedPetForView.type === 'Dog' ? '🐶' : selectedPetForView.type === 'Cat' ? '🐱' : '🐾'}
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900">{selectedPetForView.name}</h3>
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 text-sm">{selectedPetForView.breed || 'Mixed Breed'}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                <div className="flex items-center gap-2 text-blue-600 mb-2">
                                    <TrendingUp size={18} /> <span className="font-bold text-sm">Weight</span>
                                </div>
                                <span className="text-xl font-bold text-slate-800">{formatWeightDisplay(selectedPetForView.weight)}</span>
                            </div>
                            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                                <div className="flex items-center gap-2 text-purple-600 mb-2">
                                    <Clock size={18} /> <span className="font-bold text-sm">Age</span>
                                </div>
                                <span className="text-xl font-bold text-slate-800">{formatAgeDisplay(selectedPetForView.age)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default ClientPortal;