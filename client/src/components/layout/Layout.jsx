import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { NotificationProvider } from './NotificationContext';

export default function Layout() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setIsCollapsed(true);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Close the mobile drawer whenever a navigation happens - otherwise the
    // open overlay keeps covering the page the user just opened.
    useEffect(() => {
        if (isMobile) setIsCollapsed(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    const openDrawer = !isMobile || !isCollapsed;

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #dc2626; /* red-600 */
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #b91c1c; /* red-700 */
                }
            `}} />
<div className="min-h-screen bg-gray-100">
                {/* Wraps the shell so the header bell and the sidebar badge read
                    one notification state and one socket. */}
                <NotificationProvider>
                <div className="flex h-screen w-full overflow-hidden relative">
                {/* Desktop: the sidebar sits inline as before. Mobile: no
                    permanent rail at all - the sidebar becomes an off-canvas
                    drawer (full expanded width) that slides over the page with
                    a dimmed backdrop, so content gets the whole screen. */}
                {!isMobile && <Sidebar isCollapsed={isCollapsed} />}
                {isMobile && (
                    <div className="md:hidden">
                        <div
                            onClick={() => setIsCollapsed(true)}
                            className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${openDrawer ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        />
                        <div
                            className={`fixed top-0 left-0 bottom-0 z-50 transform transition-transform duration-300 ease-in-out ${openDrawer ? 'translate-x-0' : '-translate-x-full'}`}
                        >
                            <Sidebar isCollapsed={false} />
                        </div>
                    </div>
                )}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header isCollapsed={isCollapsed} onToggleSidebar={toggleSidebar} />
                    <main className="flex-1 overflow-auto bg-[#F8F9FA]">
                        {/* Switched from gray-50 to a slightly cooler F8F9FA to make red accents pop */}
                        <div className={`p-4  ${isMobile ? '' : 'h-[100%]'} overflow-auto custom-scrollbar`}>
                            <Outlet />
                        </div>
                    </main>
                </div>
            </div>
                </NotificationProvider>
            </div>
        </>
    );
}
