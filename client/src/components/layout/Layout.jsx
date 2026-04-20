import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

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

    const toggleSidebar = () => {
        if (isMobile) {
            setIsCollapsed(!isCollapsed);
        } else {
            setIsCollapsed(!isCollapsed);
        }
    };

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
                <div className="flex h-screen w-full overflow-hidden">
                <Sidebar isCollapsed={isCollapsed} />
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
        </div>
        </>
    );
}
