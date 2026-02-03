import { useState } from 'react';
import { Shield, Calendar, Activity, ArrowRight, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';

const Home = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="flex flex-col min-h-screen">

            <section className="relative flex flex-col items-center justify-center pt-24 pb-32 text-center px-4 overflow-hidden bg-white">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-6xl -z-10 opacity-30 pointer-events-none">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
                    <div className="absolute top-20 right-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
                    <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-wide mb-6 border border-emerald-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Now accepting new patients
                </div>

                <h1 className="max-w-4xl text-5xl md:text-6xl font-bold tracking-tight text-slate-900 mb-6 leading-tight">
                    Modern Care for Your <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">
                        Best Friend
                    </span>
                </h1>

                <p className="max-w-2xl text-lg text-slate-600 mb-10 leading-relaxed">
                    Experience veterinary care reimagined with top-tier security for your pet's medical records.
                    Schedule appointments, track health history, and rest easy knowing your data is safe.
                </p>

                <div className="flex flex-wrap justify-center gap-4">
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-3.5 rounded-full font-semibold shadow-lg shadow-emerald-200 hover:bg-emerald-700 hover:translate-y-[-2px] transition-all"
                    >
                        Book Appointment <ArrowRight size={18} />
                    </Link>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-8 py-3.5 rounded-full font-semibold shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                        Learn More
                    </button>
                </div>
            </section>

            {/* Cards Section */}
            <section className="bg-slate-50 py-20 px-4">
                <div className="container mx-auto">
                    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">

                        {/* Card 1 */}
                        <div className="group bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-emerald-100 transition-all duration-300">
                            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <Shield size={28} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Secure Records</h3>
                            <p className="text-slate-500 leading-relaxed">
                                Your pet's medical history is encrypted and stored securely. Only authorized personnel can access sensitive data.
                            </p>
                        </div>

                        <div className="group bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-emerald-100 transition-all duration-300">
                            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <Calendar size={28} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Easy Scheduling</h3>
                            <p className="text-slate-500 leading-relaxed">
                                Book and manage appointments seamlessly through our client portal. Get real-time updates on status.
                            </p>
                        </div>

                        <div className="group bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-emerald-100 transition-all duration-300">
                            <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                <Activity size={28} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Comprehensive Care</h3>
                            <p className="text-slate-500 leading-relaxed">
                                From routine checkups to complex surgeries, we track every aspect of your pet's health journey.
                            </p>
                        </div>

                    </div>
                </div>
            </section>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="About SecureVet Clinic"
            >
                <div className="space-y-4">
                    <p className="text-slate-600">
                        SecureVet was founded with a single mission: to provide the best medical care for animals while maintaining the highest standards of data privacy.
                    </p>
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg text-emerald-800 text-sm">
                        <Heart className="flex-shrink-0 fill-emerald-500 text-emerald-500" size={20} />
                        <span>We treat over 5,000 pets annually!</span>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(false)}
                        className="w-full bg-slate-900 text-white py-2.5 rounded-lg hover:bg-slate-800 transition-colors font-medium mt-4"
                    >
                        Got it, thanks!
                    </button>
                </div>
            </Modal>

        </div>
    );
};

export default Home;