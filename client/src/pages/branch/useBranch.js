import { useState, useEffect } from 'react';
import { API } from '../../api/endpoints';

const useBranch = () => {
  const [branch, setBranch] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBranch = async () => {
      try {
        setLoading(true);
        const token = sessionStorage.getItem('authenticated');

        if (!token) {
          throw new Error("No authorization token found");
        }
        const response = await fetch(
          API.branch(),
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
          setBranch(result.data);
        } else {
          setError(result.message || 'Failed to fetch branch');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBranch();
  }, []);

  return { branch, loading, error };
};

export default useBranch;
