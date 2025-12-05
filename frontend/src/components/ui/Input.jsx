import { cn } from "../../lib/utils";

export function Input({ className, label, error, ...props }) {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-secondary-700 mb-1.5">
                    {label}
                </label>
            )}
            <input
                className={cn(
                    "w-full px-4 py-2 rounded-lg border border-secondary-200 bg-white text-secondary-900 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200",
                    error && "border-red-500 focus:ring-red-500/20 focus:border-red-500",
                    className
                )}
                {...props}
            />
            {error && (
                <p className="mt-1 text-sm text-red-600 animate-fade-in">
                    {error}
                </p>
            )}
        </div>
    );
}
