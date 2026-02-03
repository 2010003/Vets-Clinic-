import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Send, Mail, CheckCircle } from 'lucide-react';
import { auth, db } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';

const ForgotPassword = () => {
    const [submitted, setSubmitted] = useState(false);
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            // Firebase automatically sends password reset email
            // This is auto-approved by the system (no admin approval needed)
            await sendPasswordResetEmail(auth, email);
        } catch (err) {
            // Swallow error to avoid email enumeration and always show success
            console.error('Password reset error:', err);
        }

        try {
            // Log the request with auto-approved status
            await addDoc(collection(db, 'password_requests'), {
                email,
                request_date: new Date().toISOString(),
                status: 'Auto-Approved', // System auto-approves
                approved_by: 'System',
                approved_at: new Date().toISOString(),
            });
        } catch (err) {
            // Logging failure shouldn't block UX
            console.error('Failed to log password reset request', err);
        }
        
        setLoading(false);
        setSubmitted(true);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
                <div className="text-center">
                    <ShieldAlert size={40} className="mx-auto text-amber-500 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-900">Password Reset</h2>
                </div>

                {!submitted ? (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <p className="text-sm text-slate-600 bg-blue-50 p-4 rounded border border-blue-100 flex items-start gap-2">
                            <Mail size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                            <span>Enter your email and we'll send you a password reset link automatically.</span>
                        </p>
                        <input 
                            type="email" 
                            required 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            className="w-full p-3 border rounded-lg focus:border-emerald-500 outline-none" 
                            placeholder="Enter your email" 
                            disabled={loading}
                        />
                        <button 
                            disabled={loading}
                            className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold flex justify-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50"
                        >
                            <Send size={18} /> {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>
                ) : (
                    <div className="mt-8 bg-green-50 p-6 rounded-xl text-center border border-green-100">
                        <CheckCircle size={32} className="mx-auto text-green-600 mb-3" />
                        <h3 className="text-green-800 font-bold mb-2">Reset Link Sent!</h3>
                        <p className="text-green-700 text-sm">Check your email inbox for a password reset link. The link will expire in 1 hour.</p>
                        <p className="text-green-600 text-xs mt-3">If you don't see the email, check your spam folder.</p>
                    </div>
                )}
                <Link to="/login" className="flex justify-center items-center gap-2 mt-6 text-sm text-slate-500 hover:text-emerald-600"><ArrowLeft size={16} /> Back to Login</Link>
            </div>
        </div>
    );
};

export default ForgotPassword;