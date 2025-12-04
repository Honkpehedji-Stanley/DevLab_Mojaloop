import { LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';

export function Navbar({ onLogout }) {
    return (
        <nav className="bg-white border-b border-secondary-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 flex items-center">
                            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mr-3">
                                <ShieldCheck className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold text-secondary-900 tracking-tight">
                                PensionPay<span className="text-primary-600">Admin</span>
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <div className="hidden md:flex flex-col items-end mr-4">
                            <span className="text-sm font-medium text-secondary-900">Admin User</span>
                            <span className="text-xs text-secondary-500">Departement Finance</span>
                        </div>
                        <div className="h-8 w-px bg-secondary-200 mx-2 hidden md:block"></div>
                        <Button variant="ghost" size="sm" onClick={onLogout} className="text-secondary-600">
                            <LogOut className="w-4 h-4 mr-2" />
                            Se deconnecter
                        </Button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
