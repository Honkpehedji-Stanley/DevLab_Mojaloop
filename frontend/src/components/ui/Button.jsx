import { cn } from "../../lib/utils";

export function Button({ className, variant = "primary", size = "md", ...props }) {
    const variants = {
        primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-500/20",
        secondary: "bg-white text-secondary-700 border border-secondary-200 hover:bg-secondary-50 shadow-sm",
        danger: "bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-500/20",
        ghost: "bg-transparent text-secondary-600 hover:bg-secondary-100",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2",
        lg: "px-6 py-3 text-lg",
    };

    return (
        <button
            className={cn(
                "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant],
                sizes[size],
                className
            )}
            {...props}
        />
    );
}
