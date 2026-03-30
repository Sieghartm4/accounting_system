import { useState, useEffect, useCallback } from 'react';

const useDisbursements = () => {
  const [disbursements, setDisbursements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetchDisbursements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/cash_disbursements`,
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
        setDisbursements(result.data);
      } else {
        setError(result.message || 'Failed to fetch disbursements');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchDisbursements();
  }, [refetchDisbursements]);

  return { disbursements, loading, error, refetchDisbursements };
};

export default useDisbursements;
