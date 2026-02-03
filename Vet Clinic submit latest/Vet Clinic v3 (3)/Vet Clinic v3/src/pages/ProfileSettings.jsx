import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Smartphone } from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import {
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
    RecaptchaVerifier,
    PhoneAuthProvider,
    multiFactor,
    PhoneMultiFactorGenerator,
} from 'firebase/auth';
import Modal from '../components/Modal';

const ProfileSettings = () => {
    const { user, updateUser } = useAuth();
    const [activeSection, setActiveSection] = useState('profile');
    const [profileData, setProfileData] = useState({ name: '', phone: '' });
    const [securityData, setSecurityData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
    const [mfaPhone, setMfaPhone] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [mfaVerificationId, setMfaVerificationId] = useState(null);
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    useEffect(() => {
        if (user) {
            setProfileData({ name: user.name, phone: user.phone || '' });
        }
        const fbUser = auth.currentUser;
        if (fbUser) {
            try {
                const enrolled = multiFactor(fbUser).enrolledFactors || [];
                setIs2FAEnabled(enrolled.length > 0);
            } catch (e) {
                console.error('Failed to check multi-factor enrollment', e);
            }
        }
    }, [user]);

    const ensureRecaptcha = () => {
        if (typeof window === 'undefined') return null;
        if (!window.recaptchaVerifierProfile) {
            window.recaptchaVerifierProfile = new RecaptchaVerifier(
                auth,
                'recaptcha-container-profile',
                { size: 'invisible' }
            );
        }
        return window.recaptchaVerifierProfile;
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        if (!auth.currentUser) {
            alert('You must be logged in to update your profile.');
            return;
        }
        try {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                name: profileData.name,
                phone: profileData.phone,
            });
            updateUser({ name: profileData.name, phone: profileData.phone });
            try {
                await addDoc(collection(db, 'audit_logs'), {
                    user_email: auth.currentUser.email,
                    action: 'PROFILE_UPDATE',
                    details: 'User updated profile information',
                    timestamp: new Date().toISOString(),
                });
            } catch (e) {
                console.error('Failed to write profile update audit log', e);
            }
            alert('Profile updated successfully!');
        } catch (err) {
            alert(err.message);
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        if (securityData.newPassword !== securityData.confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        try {
            const currentUser = auth.currentUser;
            if (!currentUser || !currentUser.email) {
                throw new Error('You must be logged in to update your password.');
            }

            const credential = EmailAuthProvider.credential(
                currentUser.email,
                securityData.currentPassword
            );

            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, securityData.newPassword);

            alert('Password updated!');
            setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            alert(err.message || 'Failed to update password');
        }
    };

    const handleToggle2FA = async () => {
        if (!auth.currentUser) {
            alert('You must be logged in to manage 2FA.');
            return;
        }

        const fbUser = auth.currentUser;
        const mfa = multiFactor(fbUser);

        if (is2FAEnabled) {
            if (!window.confirm('Disable 2FA for this account?')) return;
            try {
                const factors = mfa.enrolledFactors || [];
                if (factors.length > 0) {
                    await mfa.unenroll(factors[0]);
                }
                setIs2FAEnabled(false);
                alert('Two-factor authentication disabled.');
            } catch (err) {
                alert(err.message || 'Failed to disable 2FA');
            }
        } else {
            if (!user) {
                alert('You must be logged in to enable 2FA.');
                return;
            }
            setMfaPhone(user.phone || '');
            setMfaCode('');
            setMfaVerificationId(null);
            setIsSetupModalOpen(true);
        }
    };

    const sendMfaCode = async () => {
        if (!auth.currentUser) {
            alert('You must be logged in to enable 2FA.');
            return;
        }
        if (!mfaPhone) {
            alert('Please enter a phone number.');
            return;
        }
        setIsSendingCode(true);
        try {
            const fbUser = auth.currentUser;
            const session = await multiFactor(fbUser).getSession();
            const recaptchaVerifier = ensureRecaptcha();
            const phoneInfoOptions = {
                phoneNumber: mfaPhone,
                session,
            };
            const provider = new PhoneAuthProvider(auth);
            const verificationId = await provider.verifyPhoneNumber(phoneInfoOptions, recaptchaVerifier);
            setMfaVerificationId(verificationId);
            alert('Verification code sent via SMS.');
        } catch (err) {
            console.error('Failed to send MFA SMS', err);
            alert(err.message || 'Failed to send verification code');
        } finally {
            setIsSendingCode(false);
        }
    };

    const verifyMfaCode = async () => {
        if (!auth.currentUser) {
            alert('You must be logged in to enable 2FA.');
            return;
        }
        if (!mfaVerificationId || !mfaCode) {
            alert('Please request and enter the SMS code.');
            return;
        }
        setIsVerifying(true);
        try {
            const fbUser = auth.currentUser;
            const cred = PhoneAuthProvider.credential(mfaVerificationId, mfaCode);
            const assertion = PhoneMultiFactorGenerator.assertion(cred);
            await multiFactor(fbUser).enroll(assertion, 'Phone');
            setIs2FAEnabled(true);
            setIsSetupModalOpen(false);
            alert('Two-factor authentication enabled with SMS.');
        } catch (err) {
            console.error('Failed to verify MFA code', err);
            alert(err.message || 'Failed to verify code');
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 relative">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Account Settings</h1>
                <div className="grid md:grid-cols-4 gap-8 mt-8">
                    <div className="md:col-span-1 space-y-2">
                        <button onClick={() => setActiveSection('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeSection === 'profile' ? 'bg-emerald-50 text-emerald-700' : 'bg-white hover:bg-slate-50'}`}><User size={18} /> Profile</button>
                        <button onClick={() => setActiveSection('security')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeSection === 'security' ? 'bg-emerald-50 text-emerald-700' : 'bg-white hover:bg-slate-50'}`}><Shield size={18} /> Security</button>
                    </div>

                    <div className="md:col-span-3 space-y-6">
                        {activeSection === 'profile' && (
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 animate-fadeIn">
                                <h2 className="text-xl font-bold text-slate-800 mb-6">Personal Info</h2>
                                <form onSubmit={handleProfileUpdate} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-sm font-medium text-slate-700">Name</label><input className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} /></div>
                                        <div><label className="text-sm font-medium text-slate-700">Phone</label><input className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: e.target.value })} /></div>
                                    </div>
                                    <button className="bg-slate-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors">Save Changes</button>
                                </form>
                            </div>
                        )}

                        {activeSection === 'security' && (
                            <>
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center animate-fadeIn">
                                    <div className="flex gap-4 items-center">
                                        <div className={`p-3 rounded-xl transition-colors ${is2FAEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}><Smartphone size={24} /></div>
                                        <div>
                                            <h3 className="font-bold text-slate-900">Two-Factor Authentication</h3>
                                            <p className="text-sm text-slate-500">{is2FAEnabled ? 'Your account is secure.' : 'Add an extra layer of security.'}</p>
                                        </div>
                                    </div>
                                    <button onClick={handleToggle2FA} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${is2FAEnabled ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>{is2FAEnabled ? 'Disable' : 'Enable'}</button>
                                </div>

                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 animate-fadeIn">
                                    <h3 className="font-bold text-slate-800 mb-4">Change Password</h3>
                                    <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                                        <input type="password" placeholder="Current Password" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={securityData.currentPassword} onChange={e => setSecurityData({ ...securityData, currentPassword: e.target.value })} />
                                        <input type="password" placeholder="New Password" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={securityData.newPassword} onChange={e => setSecurityData({ ...securityData, newPassword: e.target.value })} />
                                        <input type="password" placeholder="Confirm Password" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" value={securityData.confirmPassword} onChange={e => setSecurityData({ ...securityData, confirmPassword: e.target.value })} />
                                        <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors">Update</button>
                                    </form>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <Modal isOpen={isSetupModalOpen} onClose={() => setIsSetupModalOpen(false)} title="Enable 2FA (SMS)">
                <div className="space-y-4 text-sm">
                    <p className="text-slate-600">
                        Enter a mobile phone number to receive SMS codes when you log in.
                    </p>
                    <input
                        type="tel"
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="e.g. +60..."
                        value={mfaPhone}
                        onChange={e => setMfaPhone(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={sendMfaCode}
                        disabled={isSendingCode}
                        className="w-full bg-slate-900 text-white py-2 rounded-lg font-bold hover:bg-slate-800 disabled:opacity-60"
                    >
                        {isSendingCode ? 'Sending code...' : 'Send SMS Code'}
                    </button>

                    {mfaVerificationId && (
                        <>
                            <input
                                type="text"
                                maxLength={6}
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-center tracking-widest font-mono"
                                placeholder="Enter 6-digit code"
                                value={mfaCode}
                                onChange={e => setMfaCode(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={verifyMfaCode}
                                disabled={isVerifying || !mfaCode}
                                className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {isVerifying ? 'Verifying...' : 'Verify & Enable'}
                            </button>
                        </>
                    )}

                    <div id="recaptcha-container-profile" />
                </div>
            </Modal>
        </div>
    );
};

export default ProfileSettings;