import { useState, useEffect } from 'react';

const useCompany = () => {
  const [company, setCompany] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal and form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [status, setStatus] = useState('active');
  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    address: '',
    status: 'active',
    logo: null
  });

  // Fetch companies
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("No authorization token found");
        }
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/company`,
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
          setCompany(result.data);
        } else {
          setError(result.message || 'Failed to fetch company');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, []);

  // Modal handlers
  const handleAddClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Reset form when closing
    setFormData({
      name: '',
      owner_name: '',
      address: '',
      status: 'active',
      logo: null
    });
    setLogoPreview(null);
    setStatus('active');
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        setLogoPreview(base64);
        setFormData(prev => ({ ...prev, logo: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Update status state if field is status
    if (field === 'status') {
      setStatus(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      if (result.success) {
        // Close modal and reset form
        handleCloseModal();
        // Optionally refresh company data
        window.location.reload();
      } else {
        alert(result.message || 'Failed to create company');
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert(err.message || 'Error creating company');
    }
  };

  return { 
    company, 
    loading, 
    error,
    // Modal and form state
    isModalOpen,
    logoPreview,
    status,
    formData,
    // Modal and form handlers
    handleAddClick,
    handleCloseModal,
    handleLogoChange,
    handleInputChange,
    handleSubmit
  };
};

export default useCompany;
