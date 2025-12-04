import { Navbar } from './Navbar';

export function Layout({ children, onLogout }) {
    return (
        <div className="min-h-screen bg-secondary-50">
            <Navbar onLogout={onLogout} />
            <main className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
