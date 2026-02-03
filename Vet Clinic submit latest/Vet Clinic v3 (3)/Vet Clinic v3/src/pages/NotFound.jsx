import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

const NotFound = () => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-100">
                <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-6">
                    <AlertCircle size={32} />
                </div>
                <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Page Not Found</h2>
                <p className="text-slate-500 mb-8">The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.</p>
                <Link to="/" className="inline-block w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors">
                    Return Home
                </Link>
            </div>
        </div>
    );
};

export default NotFound;