import { useState, useEffect } from 'react';

const useProforma = () => {
  const [proforma, setProforma] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartsOfAccounts, setChartsOfAccounts] = useState([]);
  const [coaLoading, setCoaLoading] = useState(false);

  const fetchProforma = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/proforma_entries`,
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
        setProforma(result.data);
      } else {
        setError(result.message || 'Failed to fetch proforma');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchChartsOfAccounts = async () => {
    try {
      setCoaLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/charts_of_accounts`,
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
        setChartsOfAccounts(result.data);
      } else {
        console.error('Failed to fetch charts of accounts:', result.message);
      }
    } catch (err) {
      console.error('Error fetching charts of accounts:', err);
    } finally {
      setCoaLoading(false);
    }
  };

  const createProformaEntry = async (entryData) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/proforma_entries`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(entryData),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Refresh the proforma list after successful creation
        await fetchProforma();
        return { success: true, data: result.data };
      } else {
        return { success: false, error: result.message || 'Failed to create proforma entry' };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const updateProformaEntry = async (id, entryData) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/proforma_entries/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id, ...entryData })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        await fetchProforma();
        return { success: true, data: result.data };
      }

      return { success: false, error: result.message || 'Failed to update proforma entry' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchProforma();
    fetchChartsOfAccounts();
  }, []);

  return { proforma, loading, error, chartsOfAccounts, coaLoading, createProformaEntry, updateProformaEntry };
};

export default useProforma;
