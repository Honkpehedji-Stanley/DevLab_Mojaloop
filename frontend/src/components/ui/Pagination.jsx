import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

export function Pagination({
    totalItems,
    itemsPerPage = 8,
    currentPage,
    onPageChange,
    className
}) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages = [];

        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage > 3) {
                pages.push("...");
            }

            // Calculate start and end of current range
            let start = Math.max(2, currentPage - 1);
            let end = Math.min(totalPages - 1, currentPage + 1);

            // Adjust if near start
            if (currentPage <= 3) {
                end = 4;
            }

            // Adjust if near end
            if (currentPage >= totalPages - 2) {
                start = totalPages - 3;
            }

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push("...");
            }

            // Always show last page
            pages.push(totalPages);
        }

        return pages;
    };

    return (
        <div className={cn("flex items-center justify-center space-x-2", className)}>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="text-secondary-500 disabled:opacity-50"
            >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
            </Button>

            {getPageNumbers().map((page, index) => (
                page === "..." ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-secondary-400">...</span>
                ) : (
                    <Button
                        key={page}
                        variant={currentPage === page ? "primary" : "ghost"}
                        size="sm"
                        onClick={() => onPageChange(page)}
                        className={cn(
                            "w-8 h-8 p-0",
                            currentPage === page
                                ? "bg-primary-600 text-white hover:bg-primary-700"
                                : "text-secondary-600 hover:bg-secondary-100"
                        )}
                    >
                        {page}
                    </Button>
                )
            ))}

            <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="text-secondary-500 disabled:opacity-50"
            >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
        </div>
    );
}
