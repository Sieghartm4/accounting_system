import { useState, useEffect } from 'react';

const usePurchase = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPurchase = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("No authorization token found");
        }
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/purchase`,
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
        console.log('Purchase API response:', result);

        if (result.success) {
          console.log('Purchase data received:', result.data);
          setPurchases(result.data);
        } else {
          console.error('Purchase fetch error:', result.message);
          setError(result.message || 'Failed to fetch purchases');
        }
      } catch (err) {
        console.error('Purchase fetch exception:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPurchase();
  }, []);

  const refetchPurchases = async () => {
    const fetchPurchase = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("No authorization token found");
        }
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/purchase`,
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
          setPurchases(result.data);
        } else {
          setError(result.message || 'Failed to fetch purchases');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    await fetchPurchase();
  };

  return { purchases, loading, error, refetchPurchases };
};

export default usePurchase;
