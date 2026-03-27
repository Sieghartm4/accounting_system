import { useState, useEffect } from 'react';

const useVendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/vendors`,
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
        setVendors(result.data);
      } else {
        setError(result.message || 'Failed to fetch vendors');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const createVendor = async (code, name, category, type, status) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/vendors`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code, name, category, type, status })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Refresh the vendors list
        await fetchVendors();
        return { success: true, data: result.data };
      } else {
        return { success: false, message: result.message || "Failed to create vendor" };
      }
    } catch (err) {
      console.error('Error creating vendor:', err.message);
      return { success: false, message: err.message };
    }
  };

  return { vendors, loading, error, createVendor };
};

export default useVendors;
