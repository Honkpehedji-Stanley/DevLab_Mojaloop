import { useState } from 'react';
import { Download, Search, Filter, CheckCircle, XCircle, Loader2, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { FileUpload } from '../components/ui/FileUpload';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

export default function Dashboard() {
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, SUCCESS, FAILED
    const [lastUpload, setLastUpload] = useState(null);

    const handleFileUpload = async (file) => {
        if (!file) {
            setData([]);
            setLastUpload(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await api.uploadPensions(file);
            setData(response.data);
            setLastUpload({
                name: file.name,
                count: response.data.length,
                successCount: response.data.filter(d => d.status === 'SUCCESS').length,
                timestamp: new Date()
            });
        } catch (err) {
            setError(err.message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredData = data.filter(item => {
        const matchesSearch = Object.values(item).some(val =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesFilter = statusFilter === 'ALL' || item.status === statusFilter;
        return matchesSearch && matchesFilter;
    });

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
                            <FileUpload
                                onFileSelect={handleFileUpload}
                                isUploading={isLoading}
                                error={error}
                            />

                            {isLoading && (
                                <div className="mt-6 flex flex-col items-center justify-center text-center animate-fade-in">
                                    <Loader2 className="w-8 h-8 text-primary-600 animate-spin mb-2" />
                                    <p className="text-sm font-medium text-secondary-900">Traitement des transactions...</p>
                                    <p className="text-xs text-secondary-500">Cela peut prendre quelques instants</p>
                                </div>
                            )}

                            {lastUpload && !isLoading && (
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
                                        placeholder="Search..."
                                        className="pl-9 pr-4 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 w-full sm:w-48"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <select
                                    className="px-3 py-1.5 text-sm border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="ALL">Tous les statuts</option>
                                    <option value="SUCCESS">Succès</option>
                                    <option value="FAILED">Echouée</option>
                                </select>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden p-0">
                            {data.length > 0 ? (
                                <div className="overflow-auto max-h-[600px]">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Statut</TableHead>
                                                <TableHead>ID de la transaction</TableHead>
                                                <TableHead>Nom</TableHead>
                                                <TableHead>Montant</TableHead>
                                                <TableHead>Message</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredData.map((row, i) => (
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
                                                    <TableCell className="font-medium">{row.name || row.Name || 'N/A'}</TableCell>
                                                    <TableCell>{row.amount || row.Amount || 'N/A'}</TableCell>
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
                            ) : (
                                <div className="h-64 flex flex-col items-center justify-center text-secondary-400">
                                    <div className="p-4 bg-secondary-50 rounded-full mb-3">
                                        <FileText className="w-8 h-8" />
                                    </div>
                                    <p>Importez un fuchier CSV pour voir les résultas</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
