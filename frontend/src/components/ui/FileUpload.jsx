import { useState, useRef } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

export function FileUpload({ onFileSelect, isUploading, error }) {
    const [dragActive, setDragActive] = useState(false);
    const [file, setFile] = useState(null);
    const inputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = (file) => {
        if (file.type === "text/csv" || file.name.endsWith('.csv')) {
            setFile(file);
            onFileSelect(file);
        } else {
            // Handle invalid file type
            alert("Please upload a CSV file.");
        }
    };

    const removeFile = () => {
        setFile(null);
        onFileSelect(null);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <div className="w-full">
            <div
                className={cn(
                    "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-200",
                    dragActive ? "border-primary-500 bg-primary-50" : "border-secondary-300 bg-secondary-50",
                    file ? "border-primary-500 bg-primary-50/30" : "hover:bg-secondary-100",
                    error && "border-red-500 bg-red-50"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <input
                    ref={inputRef}
                    className="hidden"
                    type="file"
                    accept=".csv"
                    onChange={handleChange}
                    disabled={isUploading}
                />

                {file ? (
                    <div className="flex flex-col items-center animate-fade-in">
                        <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                            <FileText className="w-8 h-8 text-primary-600" />
                        </div>
                        <p className="text-sm font-medium text-secondary-900 mb-1">
                            {file.name}
                        </p>
                        <p className="text-xs text-secondary-500 mb-4">
                            {(file.size / 1024).toFixed(2)} KB
                        </p>
                        {!isUploading && (
                            <Button variant="ghost" size="sm" onClick={removeFile} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                Remove file
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center p-6">
                        <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                            <Upload className="w-8 h-8 text-secondary-400" />
                        </div>
                        <p className="text-lg font-medium text-secondary-900 mb-1">
                            Click to upload or drag and drop
                        </p>
                        <p className="text-sm text-secondary-500">
                            CSV files only (max 10MB)
                        </p>
                        <Button
                            variant="secondary"
                            className="mt-4"
                            onClick={() => inputRef.current?.click()}
                        >
                            Select File
                        </Button>
                    </div>
                )}
            </div>
            {error && (
                <div className="flex items-center mt-3 text-sm text-red-600 animate-fade-in">
                    <AlertCircle className="w-4 h-4 mr-1.5" />
                    {error}
                </div>
            )}
        </div>
    );
}
