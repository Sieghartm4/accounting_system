import { useState, useEffect } from 'react';

const useProductService = () => {
  const [productService, setProductService] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProductService = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("No authorization token found");
        }
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/product_service`,
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
          setProductService(result.data);
        } else {
          setError(result.message || 'Failed to fetch product service');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProductService();
  }, []);

  return { productService, loading, error };
};

export default useProductService;
