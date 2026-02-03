import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, User, Mail, Lock, Phone } from 'lucide-react';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

const Register = () => {
    const navigate = useNavigate();
    const { register } = useAuth();

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        // Clear error when user types
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // 1. Client-Side Validation
        if (formData.password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setIsLoading(true);

        try {
            // 2. Call Backend
            await register({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                password: formData.password
            });

            // 3. Success
            alert("Account created successfully! You can now login.");
            navigate('/login');

        } catch (err) {
            // 4. Handle Backend Errors (e.g. "Email already exists")
            setError(err.message || "Registration failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                        <Shield size={24} />
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-slate-900">Create Account</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Secure client registration
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100 animate-pulse">
                        {error}
                    </div>
                )}

                <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input
                            name="name"
                            type="text"
                            required
                            className="w-full pl-10 p-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 transition-colors"
                            placeholder="Full Name"
                            onChange={handleChange}
                        />
                    </div>

                    <div className="relative">
                        <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input
                            name="email"
                            type="email"
                            required
                            className="w-full pl-10 p-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 transition-colors"
                            placeholder="Email Address"
                            onChange={handleChange}
                        />
                    </div>

                    <div className="relative">
                        <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input
                            name="phone"
                            type="tel"
                            required
                            className="w-full pl-10 p-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 transition-colors"
                            placeholder="Phone Number"
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                                name="password"
                                type="password"
                                required
                                className="w-full pl-10 p-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 transition-colors"
                                placeholder="Password"
                                onChange={handleChange}
                            />
                        </div>

                        {/* Security Feature: Strength Meter */}
                        {formData.password && <PasswordStrengthMeter password={formData.password} />}

                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                                name="confirmPassword"
                                type="password"
                                required
                                className="w-full pl-10 p-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 transition-colors"
                                placeholder="Confirm Password"
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 border border-transparent rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-200 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Creating Account...' : 'Register'}
                    </button>
                </form>

                <div className="text-center text-sm">
                    <p className="text-slate-600">
                        Already have an account?{' '}
                        <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-500">
                            Sign in instead
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;