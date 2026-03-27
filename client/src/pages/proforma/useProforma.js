import { useState, useEffect } from 'react';

const useProforma = () => {
  const [proforma, setProforma] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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

    fetchProforma();
  }, []);

  return { proforma, loading, error };
};

export default useProforma;
