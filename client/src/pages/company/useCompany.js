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
  const handleAddClick = (companyData = null) => {
    if (companyData) {
      // Edit mode - populate form with existing data
      setFormData({
        company_name: companyData.mc_company_name || '',
        owner_name: companyData.mc_owner_name || '',
        address: companyData.mc_address || '',
        tin: companyData.mc_tin || '',
        website: companyData.mc_website || '',
        email: companyData.mc_email || '',
        phone: companyData.mc_phone || '',
        status: companyData.mc_status || 'active',
        logo: companyData.mc_logo || null
      });
      setLogoPreview(companyData.mc_logo || null);
      setStatus(companyData.mc_status || 'active');
    } else {
      // Create mode - reset form
      handleCloseModal();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Reset form when closing
    setFormData({
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
      
      // Check if we're in edit mode (form has company data)
      const isEditMode = Object.keys(formData).some(key => 
        key !== 'status' && formData[key] && formData[key] !== ''
      );
      
      let url = `${import.meta.env.VITE_SERVER_LINK}/company`;
      let method = 'POST';
      
      if (isEditMode) {
        // Find the company ID from the current company data
        const currentCompany = company.find(c => 
          c.mc_company_name === formData.company_name || 
          c.mc_owner_name === formData.owner_name
        );
        
        if (currentCompany) {
          url = `${import.meta.env.VITE_SERVER_LINK}/company/${currentCompany.mc_company_id}`;
          method = 'PUT';
        }
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
        // Close modal and reset form
        handleCloseModal();
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
