import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import Modal from './Modal';

const IDLE_TIMEOUT = 6 * 60 * 1000; // 6 Minutes (as per client requirement)
const WARNING_TIME = 60 * 1000; // Warning 1 minute before

const IdleTimer = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [lastActivity, setLastActivity] = useState(Date.now());
    const [showWarning, setShowWarning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(60);

    useEffect(() => {
        if (!user) return;

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

        const resetTimer = () => {
            setLastActivity(Date.now());
            if (showWarning) setShowWarning(false);
        };

        // Listen for user activity
        events.forEach(event => window.addEventListener(event, resetTimer));

        // Check for inactivity every second
        const interval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastActive = now - lastActivity;

            if (timeSinceLastActive >= IDLE_TIMEOUT) {
                // Time up!
                handleLogout();
            } else if (timeSinceLastActive >= IDLE_TIMEOUT - WARNING_TIME) {
                // Show warning
                setShowWarning(true);
                setTimeLeft(Math.ceil((IDLE_TIMEOUT - timeSinceLastActive) / 1000));
            }
        }, 1000);

        return () => {
            events.forEach(event => window.removeEventListener(event, resetTimer));
            clearInterval(interval);
        };
    }, [user, lastActivity, showWarning]);

    const handleLogout = () => {
        setShowWarning(false);
        logout();
        navigate('/login');
        alert("Session expired due to inactivity. Please login again.");
    };

    return (
        <Modal isOpen={showWarning} onClose={() => { }} title="Session Expiring">
            <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                    <Clock size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Are you still there?</h3>
                <p className="text-slate-600">
                    For security, your session will end in <span className="font-bold text-amber-600">{timeLeft} seconds</span> due to inactivity.
                </p>
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={handleLogout}
                        className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                    >
                        Log Out
                    </button>
                    <button
                        onClick={() => { setLastActivity(Date.now()); setShowWarning(false); }}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors"
                    >
                        I'm Here
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default IdleTimer;