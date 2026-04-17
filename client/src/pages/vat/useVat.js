import { useState, useEffect } from 'react';

const useVat = () => {
  const [vat, setVat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchVat = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/vat`,
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
        setVat(result.data);
      } else {
        setError(result.message || 'Failed to fetch VAT data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createVatEntry = async (vatData) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/vat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(vatData)
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Refresh the VAT list
        await fetchVat();
        return { success: true, data: result.data };
      } else {
        return { success: false, error: result.message };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateVatEntry = async (id, vatData) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/vat/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(vatData)
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Refresh the VAT list
        await fetchVat();
        return { success: true, data: result.data };
      } else {
        return { success: false, error: result.message };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchVat();
  }, []);

  return { vat, loading, error, createVatEntry, updateVatEntry, refreshVat: fetchVat };
};

export default useVat;
