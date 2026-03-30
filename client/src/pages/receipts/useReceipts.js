import { useState, useEffect, useCallback } from 'react';

const useReceipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/receipt`,
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
        setReceipts(result.data);
      } else {
        setError(result.message || 'Failed to fetch receipts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchReceipts();
  }, [refetchReceipts]);

  return { receipts, loading, error, refetchReceipts };
};

export default useReceipts;
