import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Mail, User, Phone, Building2, Shield, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import api from '../../lib/api';

export default function CreateUser() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [organizations, setOrganizations] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        first_name: '',
        last_name: '',
        role: 'GESTIONNAIRE',
        organization_id: '',
        phone_number: ''
    });

    useEffect(() => {
        // Vérifier que l'utilisateur est admin
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.is_staff && !user.is_superuser) {
            navigate('/dashboard');
            return;
        }

        // Charger les organisations
        loadOrganizations();
    }, [navigate]);

    const loadOrganizations = async () => {
        try {
            const orgs = await api.getOrganizations();
            setOrganizations(orgs);
            // Sélectionner la première organisation par défaut
            if (orgs.length > 0) {
                setFormData(prev => ({ ...prev, organization_id: orgs[0].id }));
            }
        } catch (err) {
            console.error('Erreur chargement organisations:', err);
            // Fallback: utiliser organisation hardcodée si l'endpoint n'existe pas encore
            setOrganizations([{ id: 1, name: 'CNSS Bénin', code: 'CNSS-BJ' }]);
            setFormData(prev => ({ ...prev, organization_id: 1 }));
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError(''); // Clear error on change
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(null);
        setLoading(true);

        // Validation
        if (!formData.email || !formData.first_name || !formData.last_name) {
            setError('Les champs email, prénom et nom sont requis');
            setLoading(false);
            return;
        }

        if (!formData.organization_id) {
            setError('Veuillez sélectionner une organisation');
            setLoading(false);
            return;
        }

        try {
            const result = await api.adminCreateUser({
                ...formData,
                organization_id: parseInt(formData.organization_id)
            });

            setSuccess(result);

            // Réinitialiser le formulaire après succès
            setFormData({
                email: '',
                first_name: '',
                last_name: '',
                role: 'GESTIONNAIRE',
                organization_id: organizations[0]?.id || '',
                phone_number: ''
            });

        } catch (err) {
            setError(err.message || 'Erreur lors de la création de l\'utilisateur');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Erreur copie:', err);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-white p-6">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="text-secondary-600 hover:text-secondary-800 mb-4 flex items-center gap-2"
                    >
                        ← Retour au tableau de bord
                    </button>
                    <h1 className="text-3xl font-bold text-secondary-900 flex items-center gap-3">
                        <UserPlus className="w-8 h-8 text-primary-600" />
                        Créer un nouvel utilisateur
                    </h1>
                    <p className="text-secondary-600 mt-2">
                        Créez un compte utilisateur et envoyez automatiquement les identifiants par email
                    </p>
                </div>

                {/* Success Message */}
                {success && (
                    <Card className="mb-6 border-green-200 bg-green-50">
                        <div className="p-6">
                            <div className="flex items-start gap-3">
                                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-green-900 mb-2">
                                        Utilisateur créé avec succès !
                                    </h3>
                                    <div className="space-y-2 text-sm text-green-800">
                                        <p><strong>Email :</strong> {success.user.email}</p>
                                        <p><strong>Nom :</strong> {success.user.first_name} {success.user.last_name}</p>
                                        <p><strong>Rôle :</strong> {success.user.role_display}</p>
                                        {success.email_sent && (
                                            <p className="flex items-center gap-2">
                                                <Mail className="w-4 h-4" />
                                                Email envoyé avec les identifiants
                                            </p>
                                        )}
                                    </div>

                                    {/* Temporary Password Display */}
                                    <div className="mt-4 p-4 bg-white rounded-lg border border-green-300">
                                        <p className="text-sm font-medium text-secondary-700 mb-2">
                                            Mot de passe temporaire :
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 px-3 py-2 bg-secondary-100 rounded font-mono text-lg text-secondary-900">
                                                {success.temporary_password}
                                            </code>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => copyToClipboard(success.temporary_password)}
                                                className="flex items-center gap-2"
                                            >
                                                {copySuccess ? (
                                                    <>
                                                        <CheckCircle className="w-4 h-4" />
                                                        Copié !
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-4 h-4" />
                                                        Copier
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-secondary-600 mt-2">
                                            ⚠️ Conservez ce mot de passe en lieu sûr. L'utilisateur devra le changer à la première connexion.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Error Message */}
                {error && (
                    <Card className="mb-6 border-red-200 bg-red-50">
                        <div className="p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-red-800">{error}</p>
                        </div>
                    </Card>
                )}

                {/* Form */}
                <Card>
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Email */}
                        <div>
                            <Input
                                label="Email *"
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="utilisateur@cnss.bj"
                                required
                                className="pl-10"
                            />
                            <Mail className="absolute left-3 top-[38px] w-5 h-5 text-secondary-400" />
                        </div>

                        {/* First Name & Last Name */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <Input
                                    label="Prénom *"
                                    type="text"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    placeholder="Prénom"
                                    required
                                    className="pl-10"
                                />
                                <User className="absolute left-3 top-[38px] w-5 h-5 text-secondary-400" />
                            </div>

                            <div className="relative">
                                <Input
                                    label="Nom *"
                                    type="text"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                    placeholder="Nom"
                                    required
                                    className="pl-10"
                                />
                                <User className="absolute left-3 top-[38px] w-5 h-5 text-secondary-400" />
                            </div>
                        </div>

                        {/* Role */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-secondary-700 mb-1.5">
                                Rôle *
                            </label>
                            <div className="relative">
                                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400 pointer-events-none" />
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-secondary-200 bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                                >
                                    <option value="GESTIONNAIRE">Gestionnaire (création + consultation)</option>
                                    <option value="SUPERVISEUR">Superviseur (consultation uniquement)</option>
                                </select>
                            </div>
                            <p className="text-xs text-secondary-600 mt-1">
                                {formData.role === 'GESTIONNAIRE'
                                    ? '✅ Peut créer et consulter les transferts'
                                    : '👁️ Peut uniquement consulter les transferts'}
                            </p>
                        </div>

                        {/* Organization */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-secondary-700 mb-1.5">
                                Organisation *
                            </label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400 pointer-events-none" />
                                <select
                                    name="organization_id"
                                    value={formData.organization_id}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-secondary-200 bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                                >
                                    {organizations.map(org => (
                                        <option key={org.id} value={org.id}>
                                            {org.name} ({org.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Phone Number (Optional) */}
                        <div className="relative">
                            <Input
                                label="Numéro de téléphone (optionnel)"
                                type="tel"
                                name="phone_number"
                                value={formData.phone_number}
                                onChange={handleChange}
                                placeholder="+229 97 00 00 00"
                                className="pl-10"
                            />
                            <Phone className="absolute left-3 top-[38px] w-5 h-5 text-secondary-400" />
                        </div>

                        {/* Submit Buttons */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="flex-1"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                        Création en cours...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-5 h-5 mr-2" />
                                        Créer l'utilisateur
                                    </>
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => navigate('/dashboard')}
                            >
                                Annuler
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* Info Box */}
                <Card className="mt-6 bg-blue-50 border-blue-200">
                    <div className="p-4">
                        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            <Mail className="w-5 h-5" />
                            Envoi automatique d'email
                        </h3>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>✅ Un email de bienvenue sera automatiquement envoyé</li>
                            <li>✅ L'email contiendra les identifiants de connexion</li>
                            <li>✅ Le mot de passe est temporaire et sécurisé (12 caractères)</li>
                            <li>⚠️ L'utilisateur devra changer son mot de passe à la première connexion</li>
                        </ul>
                    </div>
                </Card>
            </div>
        </div>
    );
}
