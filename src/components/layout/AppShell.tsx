"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

const NO_SIDEBAR_PATHS = ["/", "/login"];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const showSidebar = !NO_SIDEBAR_PATHS.includes(pathname);

    if (!showSidebar) {
        return <>{children}</>;
    }

    return (
        <>
            <Sidebar />
            <main className="ml-56 min-h-screen">{children}</main>
        </>
    );
}
