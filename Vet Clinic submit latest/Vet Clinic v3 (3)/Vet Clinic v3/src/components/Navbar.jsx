import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Shield, LayoutDashboard, Users, FileText } from 'lucide-react';
import { Settings } from 'lucide-react';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-md shadow-sm transition-all duration-300">
            <div className="container mx-auto flex h-16 items-center justify-between px-6">

                {/* Logo Section */}
                <Link to={user ? (user.role === 'admin' ? '/admin' : user.role === 'staff' ? '/staff' : '/portal') : '/'} className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 hover:opacity-80 transition-opacity">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-emerald-200">
                        <Shield size={18} />
                    </div>
                    <span>{import.meta.env.VITE_CLINIC_NAME}</span>
                </Link>

                {/* Navigation Links */}
                <div className="flex items-center gap-6 font-medium text-sm text-slate-600">

                    {/* Show Home only if NOT logged in */}
                    {!user && (
                        <Link to="/" className="hover:text-emerald-600 transition-colors">Home</Link>
                    )}

                    {user ? (
                        <>
                            {/* Role-Based Links */}
                            {user.role === 'client' && (
                                <Link to="/portal" className="flex items-center gap-2 hover:text-emerald-600 transition-colors">
                                    <LayoutDashboard size={16} /> My Portal
                                </Link>
                            )}

                            {user.role === 'staff' && (
                                <Link to="/staff" className="flex items-center gap-2 hover:text-emerald-600 transition-colors">
                                    <LayoutDashboard size={16} /> Staff Dashboard
                                </Link>
                            )}

                            {user.role === 'admin' && (
                                <>
                                    <Link to="/admin" className="flex items-center gap-2 text-emerald-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 transition-all">
                                        <LayoutDashboard size={16} /> Admin Panel
                                    </Link>
                                    {/* You could add more direct admin links here if needed */}
                                </>
                            )}

                            {/* User Profile & Logout */}
                            <div className="ml-2 flex items-center gap-3 pl-6 border-l border-slate-200">
                                <div className="flex flex-col items-end leading-tight">
                                    <span className="font-semibold text-slate-800">{user.name}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{user.role}</span>
                                </div>

                                {/* NEW: Settings Button */}
                                <Link
                                    to="/settings"
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-emerald-600 transition-all shadow-sm"
                                    title="Account Settings"
                                >
                                    <Settings size={16} />
                                </Link>

                                <button
                                    onClick={handleLogout}
                                    className="group flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all shadow-sm"
                                    title="Logout"
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-4 pl-4 border-l border-slate-200">
                            <Link to="/login" className="hover:text-emerald-600 transition-colors">Login</Link>
                            <Link
                                to="/register"
                                className="rounded-full bg-emerald-600 px-5 py-2 text-white shadow-md shadow-emerald-200 hover:bg-emerald-700 hover:shadow-lg transition-all"
                            >
                                Register
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;