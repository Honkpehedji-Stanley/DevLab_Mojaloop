import { cn } from "../../lib/utils";

export function Table({ className, children, ...props }) {
    return (
        <div className="w-full overflow-x-auto">
            <table className={cn("w-full text-left text-sm", className)} {...props}>
                {children}
            </table>
        </div>
    );
}

export function TableHeader({ className, children, ...props }) {
    return (
        <thead className={cn("bg-secondary-50 border-b border-secondary-200", className)} {...props}>
            {children}
        </thead>
    );
}

export function TableBody({ className, children, ...props }) {
    return (
        <tbody className={cn("divide-y divide-secondary-100", className)} {...props}>
            {children}
        </tbody>
    );
}

export function TableRow({ className, children, ...props }) {
    return (
        <tr
            className={cn("hover:bg-secondary-50/50 transition-colors", className)}
            {...props}
        >
            {children}
        </tr>
    );
}

export function TableHead({ className, children, ...props }) {
    return (
        <th
            className={cn(
                "h-12 px-4 text-left align-middle font-medium text-secondary-500",
                className
            )}
            {...props}
        >
            {children}
        </th>
    );
}

export function TableCell({ className, children, ...props }) {
    return (
        <td className={cn("px-4 py-2 align-middle text-secondary-900", className)} {...props}>
            {children}
        </td>
    );
}
