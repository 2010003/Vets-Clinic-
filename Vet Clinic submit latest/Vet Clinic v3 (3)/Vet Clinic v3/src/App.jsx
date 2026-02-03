import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import ClientPortal from './pages/ClientPortal';
import NotFound from './pages/NotFound';
import Unauthorized from './pages/Unauthorized';
import ProtectedRoute from './components/ProtectedRoute';
import ProfileSettings from './pages/ProfileSettings';
import IdleTimer from './components/IdleTimer'; // Import here

function App() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <Navbar />
            <IdleTimer /> {/* Add here to protect all pages */}

            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/staff"
                    element={
                        <ProtectedRoute allowedRoles={['staff', 'admin']}>
                            <StaffDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/portal"
                    element={
                        <ProtectedRoute allowedRoles={['client']}>
                            <ClientPortal />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/settings"
                    element={
                        <ProtectedRoute>
                            <ProfileSettings />
                        </ProtectedRoute>
                    }
                />

                {/* Catch-all Route for 404 */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </div>
    );
}

export default App;