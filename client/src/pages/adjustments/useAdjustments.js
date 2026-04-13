import { useState, useEffect, useCallback } from "react";

const useAdjustments = () => {
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAdjustmentId, setSelectedAdjustmentId] = useState(null);
  const [adjustmentData, setAdjustmentData] = useState(null);
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);

  const fetchAdjustments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }

      const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/adjustments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setAdjustments(result.data || []);
      } else {
        setError(result.message || "Failed to fetch adjustments");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdjustmentDetails = useCallback(async (adjustmentId) => {
    try {
      setAdjustmentLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authorization token found");
      }

      const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/adjustments/${adjustmentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setAdjustmentData(result);
      } else {
        setError(result.message || "Failed to fetch adjustment details");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAdjustmentLoading(false);
    }
  }, []);

  const handleAdjustmentRowClick = async (adjustment_id) => {
    console.log('Adjustment clicked!');
    console.log('Adjustment ID:', adjustment_id);
    
    if (selectedAdjustmentId === adjustment_id) {
      setSelectedAdjustmentId(null);
      setAdjustmentData(null);
    } else {
      setSelectedAdjustmentId(adjustment_id);
      await fetchAdjustmentDetails(adjustment_id);
    }
  };

  const refetchAdjustments = useCallback(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  useEffect(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  return {
    adjustments,
    loading,
    error,
    selectedAdjustmentId,
    adjustmentData,
    adjustmentLoading,
    handleAdjustmentRowClick,
    refetchAdjustments,
  };
};

export default useAdjustments;
