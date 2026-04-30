import { useState, useEffect } from 'react';

const useCompany = () => {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [logoPreview, setLogoPreview] = useState(null);
  const [status, setStatus] = useState('active');
  const [formData, setFormData] = useState({
    company_name: '',
    owner_name: '',
    address: '',
    tin: '',
    website: '',
    email: '',
    phone: '',
    status: 'active',
    logo: null
  });

  // Fetch company
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("No authorization token found");
        }
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/company/single`,
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

  // Auto-populate form when company data is loaded
  useEffect(() => {
    if (company) {
      setFormData({
        company_name: company.company_name || '',
        owner_name: company.owner_name || '',
        address: company.address || '',
        tin: company.tin || '',
        website: company.website || '',
        email: company.email || '',
        phone: company.phone || '',
        status: company.status || 'active',
        logo: company.logo || null
      });
      setLogoPreview(company.logo || null);
      setStatus(company.status || 'active');
    }
  }, [company]);

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
    // Auto-format TIN to Philippines format: 123-456-789-000
    if (field === 'tin') {
      // Remove all non-digits
      const digits = value.replace(/\D/g, '');
      // Format as 123-456-789-000
      let formatted = '';
      if (digits.length > 0) {
        formatted += digits.substring(0, 3);
      }
      if (digits.length > 3) {
        formatted += '-' + digits.substring(3, 6);
      }
      if (digits.length > 6) {
        formatted += '-' + digits.substring(6, 9);
      }
      if (digits.length > 9) {
        formatted += '-' + digits.substring(9, 12);
      }
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    // Update status state if field is status
    if (field === 'status') {
      setStatus(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');

      // Check if we're in edit mode (company exists)
      const isEditMode = company !== null;

      let url = `${import.meta.env.VITE_SERVER_LINK}/company`;
      let method = 'POST';

      if (isEditMode) {
        // Use the existing company ID for update
        url = `${import.meta.env.VITE_SERVER_LINK}/company/${company.company_id}`;
        method = 'PUT';
      }

      const response = await fetch(url, {
        method: method,
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
        // Refresh company data
        window.location.reload();
      } else {
        alert(result.message || `Failed to ${isEditMode ? 'update' : 'create'} company`);
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert(err.message || `Error ${isEditMode ? 'updating' : 'creating'} company`);
    }
  };

  return { 
    company, 
    loading, 
    error,
    // Form state
    logoPreview,
    status,
    formData,
    // Form handlers
    handleLogoChange,
    handleInputChange,
    handleSubmit
  };
};

export default useCompany;
