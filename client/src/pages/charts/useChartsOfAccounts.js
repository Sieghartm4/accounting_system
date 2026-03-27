import { useState, useEffect } from 'react';

const useChartsOfAccounts = () => {
  const [chartsOfAccounts, setChartsOfAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchChartsOfAccounts = async () => {
    try {
      setLoading(true);
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
        setError(result.message || 'Failed to fetch charts of accounts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartsOfAccounts();
  }, []);

  const createChartsOfAccount = async (code, name, type, description, status) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/charts_of_accounts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code, name, type, description, status })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Refresh the charts of accounts list
        await fetchChartsOfAccounts();
        return { success: true, data: result.data };
      } else {
        return { success: false, message: result.message || "Failed to create charts of account" };
      }
    } catch (err) {
      console.error('Error creating charts of account:', err.message);
      return { success: false, message: err.message };
    }
  };

  return { chartsOfAccounts, loading, error, createChartsOfAccount };
};

export default useChartsOfAccounts;
