import { useState, useEffect } from "react";
import { API } from '../../api/endpoints';

// Select options for route access status dropdowns.
export const ROUTE_ACCESS_OPTIONS = [
    { value: 'Full Access', label: 'Full Access' },
    { value: 'No Access', label: 'No Access' },
    { value: 'Add Access', label: 'Add Access' },
    { value: 'View Access', label: 'View Access' },
    { value: 'Edit Access', label: 'Edit Access' },
    { value: 'Check Access', label: 'Check Access' },
    { value: 'Approve Access', label: 'Approve Access' },
];

const EMPTY_FORM = { access_name: '', status: 'Full Access' };

const useAccess = () => {
    const [access, setAccess] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedAccessId, setSelectedAccessId] = useState(null);
    const [routeAccessData, setRouteAccessData] = useState([]);
    const [routeAccessLoading, setRouteAccessLoading] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [toast, setToast] = useState(null);

    const showToast = (type, message) => setToast({ type, message });
    const closeToast = () => setToast(null);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const openNewRoleModal = () => {
        setFormData(EMPTY_FORM);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    // Individual route-status change from the option column.
    const handleRouteStatusChange = async (routeId, newStatus, row) => {
        try {
            const route_access_Data = {
                updates: [
                    {
                        id: row.id,
                        access_id: selectedAccessId,
                        status: newStatus,
                    },
                ],
            };

            const result = await updateRouteAccess(route_access_Data);

            if (result.success) {
                showToast('success', `Route access updated to "${newStatus}"`);
            } else {
                showToast('error', result.message || 'Failed to update route access');
            }
        } catch (error) {
            console.error('Error updating single route access:', error);
            showToast('error', 'Network error occurred while updating route access');
        }
    };

    // Bulk route-status change from checkbox actions (DynamicTable).
    const bulkSetRouteStatus = async (selectedRows, selectedValue) => {
        try {
            const route_access_Data = {
                updates: selectedRows.map((row) => ({
                    id: row.id,
                    access_id: selectedAccessId,
                    status: selectedValue,
                })),
            };

            const result = await updateRouteAccess(route_access_Data);

            if (result.success) {
                showToast(
                    'success',
                    `Access set to "${selectedValue}" for ${selectedRows.length} route(s).`,
                );
            } else {
                showToast('error', result.message || 'Failed to update route access');
            }
        } catch (error) {
            console.error('Error updating route access:', error);
            showToast('error', 'Network error occurred while updating route access');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const result = await createAccess(formData.access_name, formData.status);

            if (result.success) {
                showToast(
                    'success',
                    `Access role "${formData.access_name}" created successfully!`,
                );
                setIsModalOpen(false);
            } else {
                showToast('error', result.message || 'Failed to create access role');
            }
        } catch {
            showToast('error', 'Network error occurred while creating access role');
        }
    };

    const handleAccessRowClick = async (access_id) => {

        
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
            const token = sessionStorage.getItem('authenticated');

            if (!token) {
                throw new Error("No authorization token found");
            }

            const response = await fetch(
                API.routeAccess(),
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
            const token = sessionStorage.getItem('authenticated');

            if (!token) {
                throw new Error("No authorization token found");
            }

            const response = await fetch(
                API.access(),
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
            const token = sessionStorage.getItem('authenticated');

            if (!token) {
                throw new Error("No authorization token found");
            }

            const response = await fetch(
                API.routeAccess(),
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
                // Refresh route access data after successful update
                if (selectedAccessId) {
                    await fetchRouteAccess(selectedAccessId);
                }
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
            const token = sessionStorage.getItem('authenticated');

            if (!token) {
                throw new Error("No authorization token found");
            }

            const response = await fetch(
                API.routeAccess(),
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

            const token = sessionStorage.getItem('authenticated');

            if (!token) {
                throw new Error("No authorization token found");
            }

            const response = await fetch(
                API.access(),
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
        updateSingleRouteAccess,
        fetchRouteAccess,
        isModalOpen,
        formData,
        toast,
        openNewRoleModal,
        closeModal,
        closeToast,
        handleInputChange,
        handleRouteStatusChange,
        bulkSetRouteStatus,
        handleSubmit,
    };
};

export default useAccess;
