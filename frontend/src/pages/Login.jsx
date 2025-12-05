import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { api } from '../lib/api';

export default function Login({ onLogin }) {
    const [email, setEmail] = useState('admin@pensionpay.com');
    const [password, setPassword] = useState('#lorianne514');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await api.login(email, password);
            onLogin();
            navigate('/');
        } catch (err) {
            setError(err.message || 'Email ou mot de passe invalide');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
            <div className="w-full max-w-5xl h-[600px] bg-white rounded-3xl shadow-2xl overflow-hidden flex">
                {/* Left Side - Illustration/Branding */}
                <div className="hidden md:flex w-1/2 bg-gradient-to-br from-green-100 to-emerald-100 flex-col items-center justify-center p-12 relative">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-green-500"></div>
                        <div className="absolute bottom-20 right-20 w-32 h-32 rounded-full bg-emerald-600"></div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-4 border-green-200"></div>
                    </div>

                    <div className="z-10 flex flex-col items-center text-center">
                        <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20 mb-8 animate-fade-in-up">
                            <ShieldCheck className="w-12 h-12 text-green-600" />
                        </div>
                        <h2 className="text-3xl font-bold text-green-900 mb-4 animate-fade-in-up animation-delay-100">
                            Pension Pay
                        </h2>
                        <p className="text-green-700 max-w-xs animate-fade-in-up animation-delay-200">
                            Plateforme de gestion administrative des paiements de pension sécurisée et efficace.
                        </p>
                    </div>

                    <div className="absolute bottom-8 flex gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <div className="w-2 h-2 rounded-full bg-green-300"></div>
                        <div className="w-2 h-2 rounded-full bg-green-300"></div>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white">
                    <div className="max-w-md mx-auto w-full">
                        <div className="text-center mb-10">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Se connecter</h2>
                            <p className="text-gray-500 text-sm">Bienvenue sur votre espace administrateur</p>
                        </div>

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <Input
                                label="Email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@pensionpay.com"
                                className="bg-gray-50 border-gray-200 focus:border-green-500 focus:ring-green-500"
                            />

                            <div>
                                <Input
                                    label="Mot de passe"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="bg-gray-50 border-gray-200 focus:border-green-500 focus:ring-green-500"
                                />
                                <div className="flex justify-end mt-1">
                                    <a href="#" className="text-xs font-medium text-green-600 hover:text-green-500">
                                        Mot de passe oublié ?
                                    </a>
                                </div>
                            </div>

                            {error && (
                                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 flex items-center animate-fade-in">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full bg-green-600 hover:bg-green-700 hover:shadow-green-500/30 text-white h-11 rounded-lg shadow-lg shadow-green-500/30 transition-all duration-200"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Connexion...
                                    </>
                                ) : (
                                    'Se connecter'
                                )}
                            </Button>

                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-gray-500">Ou</span>
                                </div>
                            </div>

                            <div className="text-center">
                                <p className="text-sm text-gray-600">
                                    Nouveau sur la plateforme ?{' '}
                                    <a href="#" className="font-medium text-green-600 hover:text-green-500">
                                        Créer un compte
                                    </a>
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
