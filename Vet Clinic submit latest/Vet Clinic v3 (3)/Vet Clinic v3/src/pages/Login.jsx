import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, Smartphone } from 'lucide-react';
import { auth, db } from '../firebase';
import { getMultiFactorResolver, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier } from 'firebase/auth';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [step, setStep] = useState('password');
    const [mfaResolver, setMfaResolver] = useState(null);
    const [mfaVerificationId, setMfaVerificationId] = useState(null);
    const [mfaCode, setMfaCode] = useState('');
    const [mfaPhoneHint, setMfaPhoneHint] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const ensureLoginRecaptcha = () => {
        if (typeof window === 'undefined') return null;
        if (!window.recaptchaVerifierLogin) {
            window.recaptchaVerifierLogin = new RecaptchaVerifier(
                'recaptcha-container-login',
                { size: 'invisible' },
                auth
            );
        }
        return window.recaptchaVerifierLogin;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        setStep('password');
        setMfaResolver(null);
        setMfaVerificationId(null);
        setMfaCode('');

        try {
            const result = await login(email, password);
            if (result && result.success) {
                redirectUser(result.role);
            }
        } catch (err) {
            if (err?.code === 'auth/multi-factor-auth-required') {
                try {
                    const resolver = getMultiFactorResolver(auth, err);
                    setMfaResolver(resolver);
                    const hint = resolver?.hints?.[0]?.phoneNumber || 'your phone';
                    setMfaPhoneHint(hint);
                    setStep('mfa');
                    await startMfaSms(resolver);
                } catch (e) {
                    console.error('Failed to start MFA flow', e);
                    setError(e.message || 'Failed to start 2FA verification.');
                }
            } else {
                setError(err.message || 'Invalid credentials.');
            }
        } finally {
            setLoading(false);
        }
    };

    const redirectUser = (role) => {
        switch (role) {
            case 'admin': navigate('/admin'); break;
            case 'staff': navigate('/staff'); break;
            default: navigate('/portal');
        }
    };

    const startMfaSms = async (resolver) => {
        try {
            const recaptchaVerifier = ensureLoginRecaptcha();
            const phoneInfoOptions = {
                multiFactorHint: resolver.hints[0],
                session: resolver.session,
            };
            const provider = new PhoneAuthProvider(auth);
            const verificationId = await provider.verifyPhoneNumber(phoneInfoOptions, recaptchaVerifier);
            setMfaVerificationId(verificationId);
        } catch (e) {
            console.error('Failed to send MFA SMS', e);
            setError(e.message || 'Failed to send verification code.');
        }
    };

    const handleMfaSubmit = async (e) => {
        e.preventDefault();
        if (!mfaResolver || !mfaVerificationId || !mfaCode) return;
        setError('');
        setLoading(true);
        try {
            const cred = PhoneAuthProvider.credential(mfaVerificationId, mfaCode);
            const assertion = PhoneMultiFactorGenerator.assertion(cred);
            const userCredential = await mfaResolver.resolveSignIn(assertion);
            const fbUser = userCredential.user;
            const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
            const profile = userDoc.exists() ? userDoc.data() : {};
            const role = profile.role || 'client';
            try {
                await addDoc(collection(db, 'audit_logs'), {
                    user_email: fbUser.email,
                    action: 'LOGIN_SUCCESS',
                    details: 'User logged in with MFA',
                    timestamp: new Date().toISOString(),
                });
            } catch (logErr) {
                console.error('Failed to write MFA login log', logErr);
            }
            redirectUser(role);
        } catch (e) {
            console.error('MFA resolve failed', e);
            setError(e.message || 'Invalid verification code.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                        <Shield size={24} />
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-slate-900">
                        Sign in to SecureVet
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Access your secure dashboard
                    </p>
                </div>

                {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm text-center border border-red-100">{error}</div>}

                {step === 'password' && (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-10 p-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500"
                                    placeholder="Email address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="password"
                                    required
                                    className="w-full pl-10 p-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 font-bold transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-60"
                        >
                            {loading ? 'Signing in...' : 'Continue'} <ArrowRight size={16} />
                        </button>
                    </form>
                )}

                {step === 'mfa' && (
                    <form className="mt-8 space-y-6" onSubmit={handleMfaSubmit}>
                        <div className="text-sm text-slate-600 flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><Smartphone size={16} /></div>
                            <p>
                                A verification code was sent to <span className="font-semibold">{mfaPhoneHint}</span>.
                                Enter the 6-digit code to finish signing in.
                            </p>
                        </div>
                        <input
                            type="text"
                            maxLength={6}
                            className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 text-center tracking-widest font-mono"
                            placeholder="000000"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={loading || !mfaCode}
                            className="w-full py-3 px-4 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 font-bold transition-all shadow-lg flex justify-center items-center gap-2 disabled:opacity-60"
                        >
                            {loading ? 'Verifying...' : 'Verify & Continue'} <ArrowRight size={16} />
                        </button>
                        <div id="recaptcha-container-login" />
                    </form>
                )}
                <div className="text-center text-sm mt-4">
                    <p className="text-slate-600">
                        Don't have an account?{' '}
                        <Link to="/register" className="font-medium text-emerald-600 hover:text-emerald-500">Register</Link>
                    </p>
                    <Link to="/forgot-password" className="text-xs text-slate-400 hover:text-slate-500 block mt-3">Forgot Password?</Link>
                </div>
            </div>
        </div>
    );
};

export default Login;