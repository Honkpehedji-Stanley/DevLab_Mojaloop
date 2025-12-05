import { useState, useRef } from 'react';
import { Download, Search, CheckCircle, XCircle, Loader2, FileText, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { FileUpload } from '../components/ui/FileUpload';
import { Pagination } from '../components/ui/Pagination';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

export default function Dashboard() {
    const [data, setData] = useState([]);
    const [file, setFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [processingMessage, setProcessingMessage] = useState('');
    const [progress, setProgress] = useState(0);

    const itemsPerPage = 8;
    const abortControllerRef = useRef(null);

    const handleFileSelect = (selectedFile) => {
        setFile(selectedFile);
        setError(null);
        setData([]);
        setProgress(0);
        setProcessingMessage('');
    };

    const handleUploadAndProcess = async () => {
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setProcessingMessage('Initialisation du transfert...');
        setProgress(0);
        setData([]);

        try {
            // 1. Upload CSV
            const { bulkTransferId } = await api.uploadCSV(file);
            setProcessingMessage('Traitement en cours...');

            // 2. Start SSE Stream
            await streamProgress(bulkTransferId);

        } catch (err) {
            setError(err.message);
            setIsLoading(false);
            setProcessingMessage('');
        }
    };

    const streamProgress = async (bulkId) => {
        abortControllerRef.current = new AbortController();

        try {
            // Poll the status endpoint every 2 seconds instead of using SSE
            // since the backend doesn't support text/event-stream
            const pollInterval = 2000; // 2 seconds
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
                        setIsLoading(false);
                        return;
                    }

                    // Wait before next poll
                    await new Promise(resolve => setTimeout(resolve, pollInterval));

                } catch (pollError) {
                    console.error('Error polling status:', pollError);
                    // Continue polling even if one request fails
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Polling error:', err);
            setError('Erreur lors de la récupération du statut. Tentative de récupération du statut final...');
            await fetchFinalStatus(bulkId);
            setIsLoading(false);
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
                setData(mappedData);
            }
        } catch (err) {
            setError('Impossible de récupérer le statut final: ' + err.message);
        }
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsLoading(false);
        setProcessingMessage('Annulé par l\'utilisateur');
    };

    // Filter and Pagination
    const filteredData = data.filter(item => {
        const matchesSearch = Object.values(item).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesFilter = statusFilter === 'ALL' || item.status === statusFilter;
        return matchesSearch && matchesFilter;
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

    const downloadReport = () => {
        if (data.length === 0) return;
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).join(','));
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `rapport_pensions_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-secondary-900">Tableau de bord</h1>
                    <p className="text-secondary-500">Gestion des pensions et suivi en temps réel.</p>
                </div>
                {data.length > 0 && (
                    <Button onClick={downloadReport} className="animate-fade-in">
                        <Download className="w-4 h-4 mr-2" />
                        Télécharger le rapport
                    </Button>
                )}
            </div>

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
                                isUploading={isLoading}
                                error={error}
                            />

                            {file && !isLoading && (
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

                            {isLoading && (
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

                            {error && !isLoading && (
                                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start">
                                    <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                                    <span>{error}</span>
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
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400" />
                                    <input
                                        type="text"
                                        placeholder="Rechercher..."
                                        className="pl-9 pr-4 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 w-full sm:w-48"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                    />
                                </div>
                                <select
                                    className="px-3 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                >
                                    <option value="ALL">Tous les statuts</option>
                                    <option value="SUCCESS">Succès</option>
                                    <option value="FAILED">Echouée</option>
                                    <option value="PENDING">En attente</option>
                                </select>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
                            {data.length > 0 ? (
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
                                                {currentItems.map((row, i) => (
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
                                    {filteredData.length > itemsPerPage && (
                                        <div className="p-4 border-t border-secondary-200">
                                            <Pagination
                                                totalItems={filteredData.length}
                                                itemsPerPage={itemsPerPage}
                                                currentPage={currentPage}
                                                onPageChange={setCurrentPage}
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
        </div>
    );
}
