import { useState, useEffect, useRef } from 'react';
import { History, Upload, Eye, Calendar, Filter, RefreshCw, Loader2, AlertCircle, Download, FileText, CheckCircle, XCircle, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { FileUpload } from '../components/ui/FileUpload';
import { Pagination } from '../components/ui/Pagination';
import api from '../lib/api';
import usePermissions from '../hooks/usePermissions';
import { cn } from '../lib/utils';

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState('history'); // 'upload' or 'history'

    // Upload states
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [processingMessage, setProcessingMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const [uploadResults, setUploadResults] = useState([]);
    const [uploadCurrentPage, setUploadCurrentPage] = useState(1);
    const [uploadSearchTerm, setUploadSearchTerm] = useState('');
    const [uploadStatusFilter, setUploadStatusFilter] = useState('ALL');
    const [showHistoryUpdateNotice, setShowHistoryUpdateNotice] = useState(false);
    const uploadItemsPerPage = 8;
    const abortControllerRef = useRef(null);

    // History states
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        state: '',
        start_date: '',
        end_date: '',
        limit: 50,
        offset: 0,
    });
    const [total, setTotal] = useState(0);
    const permissions = usePermissions();

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab, filters]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const response = await api.getBulkTransfersHistory(filters);
            setHistory(response.results || []);
            setTotal(response.total || 0);
        } catch (error) {
            console.error('Erreur chargement historique:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (isoString) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
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

    const getStateColor = (state) => {
        const colors = {
            PENDING: 'bg-yellow-100 text-yellow-800',
            PROCESSING: 'bg-blue-100 text-blue-800',
            COMPLETED: 'bg-green-100 text-green-800',
            FAILED: 'bg-red-100 text-red-800',
            PARTIALLY_COMPLETED: 'bg-orange-100 text-orange-800',
        };
        return colors[state] || 'bg-gray-100 text-gray-800';
    };

    const getStateLabel = (state) => {
        const labels = {
            PENDING: 'En attente',
            PROCESSING: 'En cours',
            COMPLETED: 'Terminé',
            FAILED: 'Échoué',
            PARTIALLY_COMPLETED: 'Partiellement terminé',
        };
        return labels[state] || state;
    };

    // Upload functions
    const handleFileSelect = (selectedFile) => {
        setFile(selectedFile);
        setUploadError(null);
        setUploadResults([]);
        setUploadCurrentPage(1);
        setUploadSearchTerm('');
        setUploadStatusFilter('ALL');
        setProgress(0);
        setProcessingMessage('');
    };

    const handleUploadAndProcess = async () => {
        if (!file) return;

        setIsUploading(true);
        setUploadError(null);
        setProcessingMessage('Initialisation du transfert...');
        setProgress(0);
        setUploadResults([]);

        try {
            // 1. Upload CSV
            const { bulkTransferId } = await api.uploadCSV(file);
            setProcessingMessage('Traitement en cours...');

            // 2. Start SSE Stream
            await streamProgress(bulkTransferId);

        } catch (err) {
            setUploadError(err.message);
            setIsUploading(false);
            setProcessingMessage('');
        }
    };

    const streamProgress = async (bulkId) => {
        abortControllerRef.current = new AbortController();

        try {
            // Poll the status endpoint every 2 seconds
            const pollInterval = 2000;
            let isComplete = false;

            while (!isComplete && !abortControllerRef.current.signal.aborted) {
                try {
                    const status = await api.getBulkTransferStatus(bulkId);

                    // Update progress
                    if (status.progress_percent !== undefined) {
                        setProgress(status.progress_percent);
                    }

                    if (status.completed !== undefined && status.total !== undefined) {
                        setProcessingMessage(`Traitement: ${status.completed}/${status.total} transactions`);
                    }

                    // Check if processing is complete
                    if (status.state === 'COMPLETED' || status.state === 'FAILED' || status.state === 'PARTIALLY_COMPLETED') {
                        isComplete = true;
                        setProcessingMessage(status.state === 'COMPLETED' ? 'Traitement terminé !' : 'Traitement terminé avec des erreurs.');
                        await fetchFinalStatus(bulkId);
                        setIsUploading(false);
                        // Recharger l'historique après le transfert
                        await loadHistory();
                        // Afficher la notification pendant 5 secondes
                        setShowHistoryUpdateNotice(true);
                        setTimeout(() => setShowHistoryUpdateNotice(false), 5000);
                        return;
                    }

                    // Wait before next poll
                    await new Promise(resolve => setTimeout(resolve, pollInterval));

                } catch (pollError) {
                    console.error('Error polling status:', pollError);
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Polling error:', err);
            setUploadError('Erreur lors de la récupération du statut. Tentative de récupération du statut final...');
            await fetchFinalStatus(bulkId);
            setIsUploading(false);
            // Recharger l'historique même en cas d'erreur
            loadHistory();
        }
    };

    const fetchFinalStatus = async (bulkId) => {
        try {
            const status = await api.getBulkTransferStatus(bulkId);
            if (status.individualTransfers) {
                const mappedData = status.individualTransfers.map((transfer) => ({
                    transactionId: transfer.transferId,
                    type_id: transfer.payee_party_id_type,
                    valeur_id: transfer.payee_party_identifier,
                    nom_complet: transfer.payee_name || '-',
                    montant: transfer.amount,
                    devise: transfer.currency,
                    status: transfer.status === 'COMPLETED' ? 'SUCCESS' : (transfer.status === 'PENDING' ? 'PENDING' : 'FAILED'),
                    message: transfer.error_message || (transfer.status === 'COMPLETED' ? 'Succès' : 'En attente'),
                    completed_at: transfer.completed_at
                }));
                setUploadResults(mappedData);
            }
        } catch (err) {
            setUploadError('Impossible de récupérer le statut final: ' + err.message);
        }
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsUploading(false);
        setProcessingMessage('Annulé par l\'utilisateur');
    };

    const downloadReport = () => {
        if (uploadResults.length === 0) return;
        const headers = Object.keys(uploadResults[0]).join(',');
        const rows = uploadResults.map(row => Object.values(row).join(','));
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `rapport_pensions_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter upload results
    const filteredUploadResults = uploadResults.filter(item => {
        const matchesSearch = uploadSearchTerm === '' ||
            item.nom_complet?.toLowerCase().includes(uploadSearchTerm.toLowerCase()) ||
            item.valeur_id?.toLowerCase().includes(uploadSearchTerm.toLowerCase()) ||
            item.transactionId?.toLowerCase().includes(uploadSearchTerm.toLowerCase());

        const matchesStatus = uploadStatusFilter === 'ALL' || item.status === uploadStatusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-white p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-secondary-900">
                        Tableau de bord
                    </h1>
                    <p className="text-secondary-600 mt-2">
                        {permissions.isGestionnaire
                            ? 'Gérez vos transferts en masse et consultez l\'historique'
                            : 'Consultez l\'historique des transferts'}
                    </p>
                </div>

                {/* Notification de mise à jour de l'historique */}
                {showHistoryUpdateNotice && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 animate-fade-in">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-green-900">
                                Transfert terminé avec succès !
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                                L'historique a été mis à jour. Consultez l'onglet "Historique" pour voir le nouveau transfert.
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveTab('history')}
                            className="text-green-700 hover:bg-green-100"
                        >
                            Voir l'historique
                        </Button>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {permissions.canCreateTransfers && (
                        <Button
                            variant={activeTab === 'upload' ? 'primary' : 'secondary'}
                            onClick={() => setActiveTab('upload')}
                            className="flex items-center gap-2"
                        >
                            <Upload className="w-4 h-4" />
                            Nouveau transfert
                        </Button>
                    )}
                    <Button
                        variant={activeTab === 'history' ? 'primary' : 'secondary'}
                        onClick={() => setActiveTab('history')}
                        className="flex items-center gap-2"
                    >
                        <History className="w-4 h-4" />
                        Historique
                    </Button>
                </div>

                {/* Content */}
                {activeTab === 'upload' && permissions.canCreateTransfers ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Upload Section */}
                        <div className="lg:col-span-1">
                            <Card className="h-full">
                                <CardHeader>
                                    <CardTitle>Importer CSV</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <FileUpload
                                        sendFile={setFile}
                                        onFileSelect={handleFileSelect}
                                        isUploading={isUploading}
                                        error={uploadError}
                                    />

                                    {file && !isUploading && (
                                        <div className="mt-4 animate-fade-in">
                                            <div className="p-3 bg-secondary-50 rounded-lg border border-secondary-100 mb-4">
                                                <p className="text-sm font-medium text-secondary-900 truncate">{file.name}</p>
                                                <p className="text-xs text-secondary-500">{(file.size / 1024).toFixed(2)} KB</p>
                                            </div>
                                            <Button onClick={handleUploadAndProcess} className="w-full">
                                                Lancer le traitement
                                            </Button>
                                        </div>
                                    )}

                                    {isUploading && (
                                        <div className="mt-6 space-y-4 animate-fade-in">
                                            <div className="flex flex-col items-center justify-center text-center">
                                                <Loader2 className="w-8 h-8 text-primary-600 animate-spin mb-2" />
                                                <p className="text-sm font-medium text-secondary-900">{processingMessage}</p>
                                                <p className="text-xs text-secondary-500">{progress.toFixed(1)}%</p>
                                            </div>
                                            <div className="w-full bg-secondary-100 rounded-full h-2.5">
                                                <div
                                                    className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                            </div>
                                            <Button variant="ghost" onClick={handleCancel} className="w-full text-red-600 hover:bg-red-50">
                                                Annuler
                                            </Button>
                                        </div>
                                    )}

                                    {uploadError && !isUploading && (
                                        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start">
                                            <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                                            <span>{uploadError}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Results Table Section */}
                        <div className="lg:col-span-2">
                            <Card className="h-full flex flex-col">
                                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <CardTitle>Résultats des transactions</CardTitle>
                                    <div className="flex items-center gap-2">
                                        {uploadResults.length > 0 && (
                                            <>
                                                <div className="relative">
                                                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Rechercher..."
                                                        className="pl-9 pr-4 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 w-full sm:w-48"
                                                        value={uploadSearchTerm}
                                                        onChange={(e) => {
                                                            setUploadSearchTerm(e.target.value);
                                                            setUploadCurrentPage(1);
                                                        }}
                                                    />
                                                </div>
                                                <select
                                                    className="px-3 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                                                    value={uploadStatusFilter}
                                                    onChange={(e) => {
                                                        setUploadStatusFilter(e.target.value);
                                                        setUploadCurrentPage(1);
                                                    }}
                                                >
                                                    <option value="ALL">Tous les statuts</option>
                                                    <option value="SUCCESS">Succès</option>
                                                    <option value="FAILED">Échoué</option>
                                                    <option value="PENDING">En attente</option>
                                                </select>
                                                <Button onClick={downloadReport} size="sm">
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Télécharger
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
                                    {uploadResults.length > 0 ? (
                                        <>
                                            <div className="overflow-auto flex-1">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Statut</TableHead>
                                                            <TableHead>ID</TableHead>
                                                            <TableHead>Bénéficiaire</TableHead>
                                                            <TableHead>Montant</TableHead>
                                                            <TableHead>Message</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {filteredUploadResults
                                                            .slice(
                                                                (uploadCurrentPage - 1) * uploadItemsPerPage,
                                                                uploadCurrentPage * uploadItemsPerPage
                                                            )
                                                            .map((row, i) => (
                                                                <TableRow key={i}>
                                                                    <TableCell>
                                                                        <span className={cn(
                                                                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                                            row.status === 'SUCCESS' ? "bg-green-100 text-green-800" :
                                                                                row.status === 'PENDING' ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                                                                        )}>
                                                                            {row.status === 'SUCCESS' ? <CheckCircle className="w-3 h-3 mr-1" /> :
                                                                                row.status === 'PENDING' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> :
                                                                                    <XCircle className="w-3 h-3 mr-1" />}
                                                                            {row.status}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell className="font-mono text-xs text-secondary-500">{row.transactionId}</TableCell>
                                                                    <TableCell>
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium">{row.nom_complet}</span>
                                                                            <span className="text-xs text-secondary-500">{row.type_id}: {row.valeur_id}</span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>{row.montant} {row.devise}</TableCell>
                                                                    <TableCell className="text-secondary-500 max-w-xs truncate" title={row.message}>{row.message}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                            {filteredUploadResults.length > uploadItemsPerPage && (
                                                <div className="p-4 border-t border-secondary-200">
                                                    <Pagination
                                                        totalItems={filteredUploadResults.length}
                                                        itemsPerPage={uploadItemsPerPage}
                                                        currentPage={uploadCurrentPage}
                                                        onPageChange={setUploadCurrentPage}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="h-64 flex flex-col items-center justify-center text-secondary-400">
                                            <div className="p-4 bg-secondary-50 rounded-full mb-3">
                                                <FileText className="w-8 h-8" />
                                            </div>
                                            <p>Aucune donnée à afficher</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Filters */}
                        <Card className="mb-6">
                            <div className="p-4">
                                <div className="flex flex-wrap gap-4 items-end">
                                    <div className="flex-1 min-w-[200px]">
                                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                                            État
                                        </label>
                                        <select
                                            value={filters.state}
                                            onChange={(e) => setFilters({ ...filters, state: e.target.value, offset: 0 })}
                                            className="w-full px-3 py-2 rounded-lg border border-secondary-200 bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                        >
                                            <option value="">Tous les états</option>
                                            <option value="PENDING">En attente</option>
                                            <option value="PROCESSING">En cours</option>
                                            <option value="COMPLETED">Terminé</option>
                                            <option value="FAILED">Échoué</option>
                                            <option value="PARTIALLY_COMPLETED">Partiellement terminé</option>
                                        </select>
                                    </div>

                                    <div className="flex-1 min-w-[200px]">
                                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                                            Date début
                                        </label>
                                        <input
                                            type="date"
                                            value={filters.start_date}
                                            onChange={(e) => setFilters({ ...filters, start_date: e.target.value, offset: 0 })}
                                            className="w-full px-3 py-2 rounded-lg border border-secondary-200 bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                        />
                                    </div>

                                    <div className="flex-1 min-w-[200px]">
                                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                                            Date fin
                                        </label>
                                        <input
                                            type="date"
                                            value={filters.end_date}
                                            onChange={(e) => setFilters({ ...filters, end_date: e.target.value, offset: 0 })}
                                            className="w-full px-3 py-2 rounded-lg border border-secondary-200 bg-white text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                        />
                                    </div>

                                    <Button
                                        variant="secondary"
                                        onClick={loadHistory}
                                        disabled={loading}
                                        className="flex items-center gap-2"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                        Actualiser
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* History Table */}
                        <Card>
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-semibold">
                                        Historique des transferts ({total})
                                    </h2>
                                </div>

                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="text-center py-12 text-secondary-500">
                                        Aucun transfert trouvé
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-secondary-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700">
                                                        ID Transfert
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700">
                                                        Date
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700">
                                                        Montant
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700">
                                                        Transactions
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700">
                                                        État
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-secondary-100">
                                                {history.map((item) => (
                                                    <tr key={item.id} className="hover:bg-secondary-50 transition-colors">
                                                        <td className="px-4 py-3 text-sm font-mono text-secondary-900">
                                                            {item.bulk_id.substring(0, 8)}...
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-secondary-700">
                                                            {formatDate(item.created_at)}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-semibold text-secondary-900">
                                                            {formatAmount(item.total_amount, item.currency)}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-secondary-700">
                                                            <div className="flex flex-col">
                                                                <span>{item.transfers_count} total</span>
                                                                <span className="text-xs text-green-600">
                                                                    ✓ {item.completed_count} réussis
                                                                </span>
                                                                {item.failed_count > 0 && (
                                                                    <span className="text-xs text-red-600">
                                                                        ✗ {item.failed_count} échoués
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStateColor(item.state)}`}>
                                                                {getStateLabel(item.state)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => window.open(`/transfers/${item.bulk_id}`, '_blank')}
                                                                className="flex items-center gap-1"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                                Détails
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Pagination */}
                                {total > filters.limit && (
                                    <div className="mt-6 flex items-center justify-between">
                                        <div className="text-sm text-secondary-600">
                                            Affichage {filters.offset + 1} - {Math.min(filters.offset + filters.limit, total)} sur {total}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={filters.offset === 0}
                                                onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
                                            >
                                                Précédent
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={filters.offset + filters.limit >= total}
                                                onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
                                            >
                                                Suivant
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}
