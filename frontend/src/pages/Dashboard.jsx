import { useState } from 'react';
import { Download, Search, Filter, CheckCircle, XCircle, Loader2, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
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
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, SUCCESS, FAILED
    const [lastUpload, setLastUpload] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [validationResult, setValidationResult] = useState(null);
    const [bulkStatus, setBulkStatus] = useState(null);
    const [processingMessage, setProcessingMessage] = useState('');

    const itemsPerPage = 8;

    const handleFileUpload = async (file) => {
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setValidationResult(null);

        try {
            const result = await api.validatePensions(file);
            setValidationResult(result);
        } catch (err) {
            setError(err.message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitFile = async (file) => {
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setBulkStatus(null);
        setProcessingMessage('Upload du fichier CSV...');

        try {
            // Upload CSV and create bulk transfer
            const result = await api.uploadCSV(file);

            setProcessingMessage(`Transfert créé: ${result.bulkTransferId}. Traitement en cours...`);
            setBulkStatus(result);

            // Poll for status updates
            const finalStatus = await api.pollBulkStatus(
                result.bulkTransferId,
                (status) => {
                    setBulkStatus(status);
                    const completed = status.individualTransfers?.filter(t => t.status === 'COMPLETED').length || 0;
                    const total = status.individualTransfers?.length || 0;
                    setProcessingMessage(`Traitement: ${completed}/${total} transferts complétés...`);

                    // Update table data in real-time
                    const mappedData = status.individualTransfers.map((transfer) => ({
                        transactionId: transfer.transferId,
                        type_id: transfer.payee_party_id_type,
                        valeur_id: transfer.payee_party_identifier,
                        nom_complet: transfer.payee_name || '-',
                        montant: transfer.amount,
                        devise: transfer.currency,
                        status: transfer.status === 'COMPLETED' ? 'SUCCESS' : (transfer.status === 'PENDING' ? 'PENDING' : 'FAILED'),
                        message: transfer.status === 'COMPLETED'
                            ? 'Transfert complété avec succès'
                            : (transfer.status === 'PENDING' ? 'En attente de traitement' : 'Transfert échoué'),
                        completed_at: transfer.completed_at
                    }));
                    setData(mappedData);
                }
            );

            setProcessingMessage('');
        } catch (err) {
            setError(err.message);
            setProcessingMessage('');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!validationResult) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await api.confirmPensions(validationResult.uploadId);
            setData(response);
            setLastUpload({
                count: response.length,
                successCount: response.filter(d => d.status === 'SUCCESS').length,
                timestamp: new Date()
            });
            setValidationResult(null);
            setCurrentPage(1);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!validationResult) return;

        try {
            await api.cancelPensions(validationResult.uploadId);
        } catch (err) {
            console.error(err);
        }
        setValidationResult(null);
        setError(null);
    };

    const filteredData = data.filter(item => {
        const matchesSearch = Object.values(item).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesFilter = statusFilter === 'ALL' || item.status === statusFilter;
        return matchesSearch && matchesFilter;
    });

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

    const downloadReport = () => {
        if (data.length === 0) return;

        // Simple CSV download logic
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).join(','));
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `pension_report_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-secondary-900">Tableau de bord</h1>
                    <p className="text-secondary-500">Gestion des pensions et affichage des rapports de transactions.</p>
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
                            {!validationResult ? (
                                <>
                                    <FileUpload
                                        sendFile={setFile}
                                        onFileSelect={handleFileUpload}
                                        isUploading={isLoading}
                                        error={error}
                                    />
                                    {isLoading && (
                                        <div className="mt-6 flex flex-col items-center justify-center text-center animate-fade-in">
                                            <Loader2 className="w-8 h-8 text-primary-600 animate-spin mb-2" />
                                            <p className="text-sm font-medium text-secondary-900">Traitement du fichier...</p>
                                            <p className="text-xs text-secondary-500">Veuillez patienter</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="animate-fade-in space-y-6">
                                    <div className="bg-secondary-50 p-4 rounded-lg border border-secondary-100">
                                        <h3 className="font-medium text-secondary-900 mb-3">Résumé de la validation</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-secondary-500">Total lignes:</span>
                                                <span className="font-medium">{validationResult.totalRows}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-secondary-500">Lignes valides:</span>
                                                <span className="font-medium text-primary-600">{validationResult.validCount}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-secondary-500">Lignes invalides:</span>
                                                <span className="font-medium text-red-600">{validationResult.invalidCount}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {validationResult.invalidCount > 0 && (
                                        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                                            <h4 className="font-medium text-red-800 mb-2 text-sm">Lignes ignorées ({validationResult.invalidCount})</h4>
                                            <div className="max-h-32 overflow-y-auto text-xs text-red-600 space-y-1">
                                                {validationResult.invalidRows.map((row, idx) => (
                                                    <div key={idx}>
                                                        Ligne {row.rowNumber}: {row.reason}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-3">
                                        <Button
                                            onClick={() => handleSubmitFile(file)}
                                            disabled={isLoading}
                                            className="w-full"
                                        >
                                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                            Poursuivre le transfert
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={handleCancel}
                                            disabled={isLoading}
                                            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            Annuler
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {lastUpload && !isLoading && !validationResult && (
                                <div className="mt-6 p-4 bg-secondary-50 rounded-lg border border-secondary-100 animate-fade-in">
                                    <h4 className="font-medium text-secondary-900 mb-2 flex items-center">
                                        <FileText className="w-4 h-4 mr-2 text-secondary-500" />
                                        Résumé de l'importation
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-secondary-500">Paiememts a faire:</span>
                                            <span className="font-medium">{lastUpload.count}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-secondary-500">Paiements faits:</span>
                                            <span className="font-medium text-green-600">{lastUpload.successCount}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-secondary-500">Paiements echoués:</span>
                                            <span className="font-medium text-red-600">{lastUpload.count - lastUpload.successCount}</span>
                                        </div>
                                    </div>
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
                                            setCurrentPage(1); // Reset to first page on search
                                        }}
                                    />
                                </div>
                                <select
                                    className="px-3 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value);
                                        setCurrentPage(1); // Reset to first page on filter
                                    }}
                                >
                                    <option value="ALL">Tous les statuts</option>
                                    <option value="SUCCESS">Succès</option>
                                    <option value="FAILED">Echouée</option>
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
                                                    <TableHead>ID Transaction</TableHead>
                                                    <TableHead>Type ID</TableHead>
                                                    <TableHead>Valeur ID</TableHead>
                                                    <TableHead>Nom Complet</TableHead>
                                                    <TableHead>Montant</TableHead>
                                                    <TableHead>Devise</TableHead>
                                                    <TableHead>Message</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {currentItems.map((row, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell>
                                                            <span className={cn(
                                                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                                row.status === 'SUCCESS' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                                            )}>
                                                                {row.status === 'SUCCESS' ? (
                                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                                ) : (
                                                                    <XCircle className="w-3 h-3 mr-1" />
                                                                )}
                                                                {row.status}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs text-secondary-500">{row.transactionId}</TableCell>
                                                        <TableCell>{row.type_id}</TableCell>
                                                        <TableCell>{row.valeur_id}</TableCell>
                                                        <TableCell className="font-medium">{row.nom_complet}</TableCell>
                                                        <TableCell>{row.montant}</TableCell>
                                                        <TableCell>{row.devise}</TableCell>
                                                        <TableCell className="text-secondary-500 max-w-xs truncate" title={row.message}>{row.message}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        {filteredData.length === 0 && (
                                            <div className="p-8 text-center text-secondary-500">
                                                Aucun résultat trouvé correspondant à vos filtres.
                                            </div>
                                        )}
                                    </div>

                                    {/* Pagination */}
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
                                    <p>Importez un fichier CSV pour voir les résultas</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
