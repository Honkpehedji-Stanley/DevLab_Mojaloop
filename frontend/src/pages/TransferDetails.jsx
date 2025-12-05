import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Download, Check, X, Clock, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import api from '../lib/api';

export default function TransferDetails() {
    const { bulkId } = useParams();
    const navigate = useNavigate();
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadDetails();
    }, [bulkId]);

    const loadDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getBulkTransferDetails(bulkId);
            setDetails(data);
        } catch (err) {
            setError(err.response?.data?.error || 'Erreur lors du chargement des détails');
            console.error('Erreur chargement détails:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatAmount = (amount, currency = 'XOF') => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency,
        }).format(amount / 100);
    };

    const getStateIcon = (state) => {
        const icons = {
            COMPLETED: <Check className="w-5 h-5 text-green-600" />,
            FAILED: <X className="w-5 h-5 text-red-600" />,
            PROCESSING: <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />,
            PENDING: <Clock className="w-5 h-5 text-yellow-600" />,
        };
        return icons[state] || <AlertCircle className="w-5 h-5 text-gray-600" />;
    };

    const getStateColor = (state) => {
        const colors = {
            PENDING: 'bg-yellow-100 text-yellow-800',
            PROCESSING: 'bg-blue-100 text-blue-800',
            COMPLETED: 'bg-green-100 text-green-800',
            FAILED: 'bg-red-100 text-red-800',
        };
        return colors[state] || 'bg-gray-100 text-gray-800';
    };

    const getStateLabel = (state) => {
        const labels = {
            PENDING: 'En attente',
            PROCESSING: 'En cours',
            COMPLETED: 'Terminé',
            FAILED: 'Échoué',
        };
        return labels[state] || state;
    };

    const exportToCSV = () => {
        if (!details || !details.individual_transfers) return;

        const headers = ['ID Transaction', 'Bénéficiaire', 'Montant', 'État', 'Code Erreur', 'Date Création', 'Date Fin'];
        const rows = details.individual_transfers.map(t => [
            t.transfer_id,
            t.payee_party_identifier,
            t.amount / 100,
            t.state,
            t.error_code || '',
            t.created_at,
            t.completed_at || '',
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `transfert_${bulkId}_details.csv`;
        link.click();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-white p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-white p-6">
                <div className="max-w-7xl mx-auto">
                    <Button
                        variant="ghost"
                        onClick={() => navigate(-1)}
                        className="mb-6 flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour
                    </Button>
                    <Card>
                        <div className="p-6 text-center text-red-600">
                            <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                            <p>{error}</p>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    if (!details) {
        return null;
    }

    const stats = details.statistics || {};

    return (
        <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Retour
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-secondary-900">
                                Détails du transfert
                            </h1>
                            <p className="text-sm text-secondary-600 font-mono mt-1">
                                {details.bulk_id}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            onClick={loadDetails}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Actualiser
                        </Button>
                        <Button
                            variant="primary"
                            onClick={exportToCSV}
                            className="flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Exporter CSV
                        </Button>
                    </div>
                </div>

                {/* Summary Card */}
                <Card className="mb-6">
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div>
                                <p className="text-sm text-secondary-600 mb-1">État</p>
                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStateColor(details.state)}`}>
                                    {getStateLabel(details.state)}
                                </span>
                            </div>
                            <div>
                                <p className="text-sm text-secondary-600 mb-1">Montant Total</p>
                                <p className="text-2xl font-bold text-secondary-900">
                                    {formatAmount(stats.total_amount, details.currency)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-secondary-600 mb-1">Organisation</p>
                                <p className="text-lg font-semibold text-secondary-900">
                                    {details.organization?.name || '-'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-secondary-600 mb-1">Date de création</p>
                                <p className="text-lg text-secondary-900">
                                    {formatDate(details.created_at)}
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    <Card>
                        <div className="p-4">
                            <p className="text-sm text-secondary-600 mb-2">Total</p>
                            <p className="text-3xl font-bold text-secondary-900">{stats.total_count || 0}</p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-4">
                            <p className="text-sm text-green-600 mb-2 flex items-center gap-1">
                                <Check className="w-4 h-4" />
                                Réussis
                            </p>
                            <p className="text-3xl font-bold text-green-600">{stats.completed_count || 0}</p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-4">
                            <p className="text-sm text-red-600 mb-2 flex items-center gap-1">
                                <X className="w-4 h-4" />
                                Échoués
                            </p>
                            <p className="text-3xl font-bold text-red-600">{stats.failed_count || 0}</p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-4">
                            <p className="text-sm text-yellow-600 mb-2 flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                En attente
                            </p>
                            <p className="text-3xl font-bold text-yellow-600">{stats.pending_count || 0}</p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-4">
                            <p className="text-sm text-secondary-600 mb-2">Taux de réussite</p>
                            <p className="text-3xl font-bold text-secondary-900">
                                {stats.success_rate ? `${stats.success_rate.toFixed(1)}%` : '0%'}
                            </p>
                        </div>
                    </Card>
                </div>

                {/* Individual Transfers Table */}
                <Card>
                    <div className="p-6">
                        <h2 className="text-xl font-semibold mb-4">
                            Transactions individuelles ({details.individual_transfers?.length || 0})
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-secondary-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700">
                                            ID Transaction
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700">
                                            Bénéficiaire
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700">
                                            Montant
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700">
                                            État
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700">
                                            Code Erreur
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700">
                                            Date
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-100">
                                    {details.individual_transfers && details.individual_transfers.length > 0 ? (
                                        details.individual_transfers.map((transfer) => (
                                            <tr key={transfer.id} className="hover:bg-secondary-50 transition-colors">
                                                <td className="px-4 py-3 text-sm font-mono text-secondary-900">
                                                    {transfer.transfer_id?.substring(0, 12)}...
                                                </td>
                                                <td className="px-4 py-3 text-sm text-secondary-900">
                                                    {transfer.payee_party_identifier}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold text-secondary-900">
                                                    {formatAmount(transfer.amount, transfer.currency)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {getStateIcon(transfer.state)}
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStateColor(transfer.state)}`}>
                                                            {getStateLabel(transfer.state)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-secondary-700">
                                                    {transfer.error_code ? (
                                                        <span className="text-red-600 font-mono">{transfer.error_code}</span>
                                                    ) : (
                                                        '-'
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-secondary-700">
                                                    {formatDate(transfer.created_at)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="px-4 py-8 text-center text-secondary-500">
                                                Aucune transaction trouvée
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
