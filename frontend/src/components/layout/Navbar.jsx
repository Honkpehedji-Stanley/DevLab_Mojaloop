import { LogOut, ShieldCheck, UserPlus, Menu } from 'lucide-react';
import { Button } from '../ui/Button';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

export function Navbar({ onLogout }) {
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        setUser(userData);
        setIsAdmin(userData.is_staff || userData.is_superuser || false);
    }, []);

    return (
        <nav className="bg-white border-b border-secondary-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center gap-6">
                        <Link to="/" className="flex-shrink-0 flex items-center hover:opacity-80 transition-opacity">
                            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mr-3">
                                <ShieldCheck className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold text-secondary-900 tracking-tight">
                                PensionPay<span className="text-primary-600">Admin</span>
                            </span>
                        </Link>

                        {/* Admin Navigation */}
                        {isAdmin && (
                            <div className="hidden md:flex items-center gap-2">
                                <Link to="/admin/users/create">
                                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                                        <UserPlus className="w-4 h-4" />
                                        Créer un utilisateur
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-sm font-medium text-secondary-900">
                                {user?.first_name || user?.username || 'Admin User'}
                            </span>
                            <span className="text-xs text-secondary-500">
                                {user?.role_display || user?.role || 'Administrateur'}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-secondary-200 hidden md:block"></div>
                        <Button variant="ghost" size="sm" onClick={onLogout} className="text-secondary-600 hover:text-red-600">
                            <LogOut className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">Se déconnecter</span>
                        </Button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
