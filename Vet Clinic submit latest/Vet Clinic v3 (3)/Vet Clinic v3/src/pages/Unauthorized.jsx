import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

const Unauthorized = () => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-100">
                <div className="mx-auto h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-6">
                    <ShieldAlert size={32} />
                </div>
                <h1 className="text-4xl font-bold text-slate-900 mb-2">403</h1>
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Access Denied</h2>
                <p className="text-slate-500 mb-8">You do not have the necessary permissions to view this page. This attempt has been logged for security purposes.</p>
                <Link to="/login" className="inline-block w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors">
                    Switch Account
                </Link>
            </div>
        </div>
    );
};

export default Unauthorized;