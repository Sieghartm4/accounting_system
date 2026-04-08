import { useState, useEffect } from "react";

const useAccess = () => {
    const [access, setAccess] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedAccessId, setSelectedAccessId] = useState(null);
    const [routeAccessData, setRouteAccessData] = useState([]);
    const [routeAccessLoading, setRouteAccessLoading] = useState(false);

    const handleAccessRowClick = async (access_id, userData) => {
        console.log('Access clicked!');
        console.log('Access ID:', access_id);
        console.log('Full user data:', userData);
        
        if (selectedAccessId === access_id) {
            setSelectedAccessId(null);
            setRouteAccessData([]);
        } else {
            setSelectedAccessId(access_id);
            await fetchRouteAccess(access_id);
        }
    };

    const fetchRouteAccess = async (accessId) => {
        try {
            setRouteAccessLoading(true);
            const token = localStorage.getItem("token");

            if (!token) {
                throw new Error("No authorization token found");
            }

            const response = await fetch(
                `${import.meta.env.VITE_SERVER_LINK}/route_access`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ access_id: accessId })
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                setRouteAccessData(result.data);
            } else {
                console.error('Failed to fetch route access:', result.message);
            }
        } catch (err) {
            console.error('Error fetching route access:', err.message);
        } finally {
            setRouteAccessLoading(false);
        }
    };

    const createAccess = async (access_name, status) => {
        try {
            const token = localStorage.getItem("token");

            if (!token) {
                throw new Error("No authorization token found");
            }

            const response = await fetch(
                `${import.meta.env.VITE_SERVER_LINK}/access`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ access_name, status })
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // Refresh the access list
                await fetchAccess();
                return { success: true, data: result.data };
            } else {
                return { success: false, message: result.message || "Failed to create access" };
            }
        } catch (err) {
            console.error('Error creating access:', err.message);
            return { success: false, message: err.message };
        }
    };

    const updateRouteAccess = async (route_access_Data) => {
        try {
            const token = localStorage.getItem("token");

            if (!token) {
                throw new Error("No authorization token found");
            }

            const response = await fetch(
                `${import.meta.env.VITE_SERVER_LINK}/route_access`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(route_access_Data)
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                return { success: true, data: result.data };
            } else {
                return { success: false, message: result.message || "Failed to update route access" };
            }
        } catch (err) {
            console.error('Error updating route access:', err.message);
            return { success: false, message: err.message };
        }
    };

    const updateSingleRouteAccess = async (route_id, status, access_id) => {
        try {
            const token = localStorage.getItem("token");

            if (!token) {
                throw new Error("No authorization token found");
            }

            const response = await fetch(
                `${import.meta.env.VITE_SERVER_LINK}/route_access`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ 
                        route_access_Data: {
                            route_id,
                            status,
                            access_id
                        }
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                return { success: true, data: result.data };
            } else {
                return { success: false, message: result.message || "Failed to update single route access" };
            }
        } catch (err) {
            console.error('Error updating single route access:', err.message);
            return { success: false, message: err.message };
        }
    };

    const fetchAccess = async () => {
        try {
            setLoading(true);

            const token = localStorage.getItem("token");

            if (!token) {
                throw new Error("No authorization token found");
            }

            const response = await fetch(
                `${import.meta.env.VITE_SERVER_LINK}/access`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                setAccess(result.data);
            } else {
                setError(result.message || "Failed to fetch access");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccess();
    }, []);

    return { 
        access, 
        loading, 
        error, 
        handleAccessRowClick, 
        selectedAccessId, 
        routeAccessData, 
        routeAccessLoading,
        createAccess,
        updateRouteAccess,
        updateSingleRouteAccess
    };
};

export default useAccess;
