import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useRegister from './useRegister';
import { REQUIRED_MODULES, moduleLabel } from '../../constants/modules';
import { DynamicToast } from '../../components/ui';
import { SUBSCRIPTION_API } from '../../api/endpoints';

export default function Register() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({ 
    username: '', 
    email: '',
    password: '', 
    company_name: '', 
    subscription_id: null,
    subscription_price: null,
    subscription_billing_cycle: null
  });
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [filteredPlans, setFilteredPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [seats, setSeats] = useState(1);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('warning');
  const [usedFreeTrials, setUsedFreeTrials] = useState([]);
  const [loadingUsedFreeTrials, setLoadingUsedFreeTrials] = useState(false);
  const [pendingAccount, setPendingAccount] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showFeatureMatrix, setShowFeatureMatrix] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [paymentSuccessDetails, setPaymentSuccessDetails] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

  const { register, loading, error, registerData, progress } = useRegister();

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Auto-select first plan when moving to step 2
  useEffect(() => {
    if (currentStep === 2 && !selectedPlan && filteredPlans.length > 0) {
      setSelectedPlan(filteredPlans[0]);
      setFormData(prev => ({
        ...prev,
        subscription_id: filteredPlans[0].sp_id,
        subscription_price: filteredPlans[0].price,
        subscription_billing_cycle: filteredPlans[0].billingCycle
      }));
    }
  }, [currentStep, selectedPlan, filteredPlans]);

  // Restore selected plan from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPlanId = sessionStorage.getItem('selectedPlanId');
      if (storedPlanId && plans.length > 0) {
        const matchedPlan = plans.find(p => p.sp_id === parseInt(storedPlanId));
        if (matchedPlan) {
          setSelectedPlan(matchedPlan);
          setFormData(prev => ({
            ...prev,
            subscription_id: matchedPlan.sp_id,
            subscription_price: matchedPlan.price,
            subscription_billing_cycle: matchedPlan.billingCycle
          }));
          sessionStorage.removeItem('selectedPlanId');
          sessionStorage.setItem('planRestored', 'true');
        } else {
          sessionStorage.removeItem('selectedPlanId');
        }
      }
    }
  }, [plans, selectedPlan]);

  // Check if user is coming from login without subscription
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const queryParams = new URLSearchParams(window.location.search);
      const stepParam = queryParams.get('step');
      const pendingUser = sessionStorage.getItem('pendingUser');
      
      if (stepParam === 'plan' && pendingUser) {
        const userData = JSON.parse(pendingUser);
        setFormData(prev => ({
          ...prev,
          username: userData.username,
          password: userData.password || '',
        }));

        setPendingAccount({
          username: userData.username,
          tenantDb: userData.tenantDb || null,
          email: userData.email || null,
          fullname: userData.fullname || null,
          existingAccount: userData.existingAccount === true,
        });

        setToastMessage(
          userData.existingAccount
            ? `Choose a plan for ${userData.username} to unlock the modules you don't have yet.`
            : 'You do not have an active subscription. Please complete your registration by selecting a subscription plan.',
        );
        setToastType('warning');
        setShowToast(true);
        fetchUsedFreeTrials(userData.username);
      }
    }
  }, []);

  // Handle payment status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const queryParams = new URLSearchParams(window.location.search);
      const paymentParam = queryParams.get('payment');
      
      if (paymentParam === 'success') {
        const paymentProcessed = sessionStorage.getItem('paymentProcessed');
        if (paymentProcessed) return;
        
        sessionStorage.setItem('paymentProcessed', 'true');
        
        const processPaymentSuccess = async () => {
          try {
            const pendingRegistration = sessionStorage.getItem('pendingRegistration');
            const pendingUser = sessionStorage.getItem('pendingUser');
            const isUpgrade = sessionStorage.getItem('isUpgrade') === 'true';
            const storedPlanId = sessionStorage.getItem('selectedPlanId');
            const sessionId = sessionStorage.getItem('paymongoSessionId') || queryParams.get('session_id');
            const paymentReference = queryParams.get('payment_id') || queryParams.get('source_id') || queryParams.get('payment_intent');

            console.log('Processing payment success', { pendingRegistration, pendingUser, isUpgrade, storedPlanId, sessionId });

            let username = null;
            let registrationData = null;

            // Check if this is a new registration (pendingRegistration) or existing user upgrade (pendingUser)
            if (pendingRegistration) {
              registrationData = JSON.parse(pendingRegistration);
              username = registrationData.username;
              console.log('This is a new registration for:', username);
            } else if (pendingUser || isUpgrade) {
              const userData = pendingUser ? JSON.parse(pendingUser) : null;
              username = userData?.username || pendingAccount?.username;
              console.log('This is an existing user upgrade for:', username);
            } else {
              username = sessionStorage.getItem('registeredUsername');
              console.log('Using registeredUsername:', username);
            }

            let paymentMethod = 'paymongo';
            let actualPaymentReference = paymentReference;
            let planPrice = 0;
            let billingCycleDays = null;
            let planName = 'Unknown Plan';

            if (sessionId && sessionId !== '{CHECKOUT_SESSION_ID}') {
              try {
                const paymentDetailsResponse = await fetch(SUBSCRIPTION_API.subscriptionPlansPaymentDetails(sessionId));
                const paymentDetailsData = await paymentDetailsResponse.json();

                if (paymentDetailsData.success && paymentDetailsData.data) {
                  paymentMethod = paymentDetailsData.data.payment_method || 'paymongo';
                  actualPaymentReference = paymentDetailsData.data.payment_reference || sessionId;
                  if (paymentDetailsData.data.amount) {
                    planPrice = paymentDetailsData.data.amount;
                  }
                  if (paymentDetailsData.data.billing_cycle) {
                    billingCycleDays = paymentDetailsData.data.billing_cycle;
                  }
                }
              } catch (error) {
                console.error('Error fetching payment details:', error);
              }
            }

            // Fetch plan details to get plan name
            if (storedPlanId) {
              try {
                const plansResponse = await fetch(SUBSCRIPTION_API.subscriptionPlans());
                const plansData = await plansResponse.json();
                if (plansData.data && plansData.data.length > 0) {
                  const plan = plansData.data?.find(p => p.sp_id === parseInt(storedPlanId));
                  if (plan) {
                    planName = plan.sp_name;
                    if (planPrice === 0 || planPrice === null) {
                      planPrice = plan.sp_price || 0;
                    }
                    if (billingCycleDays === null) {
                      if (plan.items && plan.items.length > 0) {
                        const billingCycleItem = plan.items.find(item => item.spi_type === 'BILLING_CYCLE');
                        if (billingCycleItem) {
                          billingCycleDays = parseInt(billingCycleItem.spi_details);
                        }
                      }
                    }
                  }
                }
              } catch (error) {
                console.error('Error fetching plan details:', error);
              }
            }

            // CRITICAL: If this is a new registration, register the user NOW (after payment success)
            // This creates the account, database, and assigns the subscription
            if (pendingRegistration && registrationData) {
              console.log('Registering user after successful payment...', registrationData);
              const success = await register(registrationData);
              if (!success) {
                console.error('Registration failed after payment');
                setPaymentError('Registration failed after payment. Please contact support.');
                return;
              }
              console.log('Registration successful after payment');
            }

            // For existing users (upgrades), update subscription
            if ((pendingUser || isUpgrade) && username && storedPlanId) {
              await fetch(SUBSCRIPTION_API.credentialsSubscription(), {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  username: username,
                  subscription_id: parseInt(storedPlanId),
                  subscription_price: planPrice,
                  subscription_billing_cycle: billingCycleDays,
                  payment_reference: actualPaymentReference,
                  payment_method: paymentMethod,
                }),
              });
            }

            // Store payment success details and show confirmation
            setPaymentSuccessDetails({
              username: username,
              email: registrationData?.email || pendingAccount?.email || '',
              companyName: registrationData?.company_name || pendingAccount?.company_name || '',
              planName: planName,
              planPrice: planPrice,
              billingCycle: billingCycleDays,
              paymentMethod: paymentMethod,
              paymentReference: actualPaymentReference,
              isNewRegistration: !!pendingRegistration,
              isUpgrade: isUpgrade || !!pendingUser
            });
            setShowConfirmation(true);

            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (error) {
            console.error('Error processing payment success:', error);
            setPaymentError('Payment processing failed. Please contact support.');
          } finally {
            sessionStorage.removeItem('paymentStatus');
            sessionStorage.removeItem('selectedPlanId');
            sessionStorage.removeItem('planRestored');
            sessionStorage.removeItem('registeredUsername');
            sessionStorage.removeItem('pendingUser');
            sessionStorage.removeItem('paymentProcessed');
            sessionStorage.removeItem('paymongoSessionId');
            sessionStorage.removeItem('pendingRegistration');
            sessionStorage.removeItem('isUpgrade');
          }
        };
        
        processPaymentSuccess();
      } else if (paymentParam === 'failed') {
        setPaymentError('Payment failed or was canceled. Please try again.');
        sessionStorage.setItem('paymentStatus', 'failed');
        window.history.replaceState({}, document.title, window.location.pathname);
        // Clear pending registration on failure
        sessionStorage.removeItem('pendingRegistration');
        sessionStorage.removeItem('isUpgrade');
      } else {
        const storedPaymentStatus = sessionStorage.getItem('paymentStatus');
        if (storedPaymentStatus === 'failed') {
          setPaymentError('Payment failed or was canceled. Please try again.');
        }
      }
    }
  }, [navigate, register, setPaymentSuccessDetails, setShowConfirmation, setPaymentError]);

  // Fetch subscription plans
  useEffect(() => {
    const fetchSubscriptionPlans = async () => {
      try {
        const response = await fetch(SUBSCRIPTION_API.subscriptionPlansPublic());
        const data = await response.json();

        if (data.success && data.data) {
          const plansWithItems = data.data.map((plan) => {
            const features = [];
            
            if (plan.items && Array.isArray(plan.items)) {
              plan.items.forEach((item) => {
                if (item.spi_type === 'FEATURES') {
                  features.push(item.spi_details);
                } else if (item.spi_type === 'USERS') {
                  const userCount = parseInt(item.spi_details);
                  if (!isNaN(userCount)) {
                    features.push(`For ${userCount} Users`);
                  }
                } else if (item.spi_type === 'BILLING_CYCLE') {
                  const cycle = item.spi_details;
                  let formattedCycle = cycle;
                  
                  if (!isNaN(parseInt(cycle))) {
                    const days = parseInt(cycle);
                    if (days === 7) formattedCycle = 'week';
                    else if (days === 30 || days === 31) formattedCycle = 'month';
                    else if (days === 60 || days === 61) formattedCycle = '2 months';
                    else if (days === 90 || days === 91) formattedCycle = '3 months';
                    else if (days === 180 || days === 182) formattedCycle = '6 months';
                    else if (days === 365 || days === 366) formattedCycle = 'year';
                    else formattedCycle = `${cycle} days`;
                  }
                  
                  plan.billingCycle = formattedCycle;
                } else if (item.spi_type === 'PRICE') {
                  plan.price = item.spi_details;
                }
              });
            }
            
            plan.features = features;
            plan.modules = Array.isArray(plan.modules) ? plan.modules : [];
            return plan;
          });

          const CORE_NOTE = 'All core accounting, journal entry and financial reporting modules';
          plansWithItems.forEach((plan) => {
            const list = [];
            if (Number(plan.sp_max_users) > 0) {
              list.push(`Up to ${plan.sp_max_users} user${Number(plan.sp_max_users) === 1 ? '' : 's'}`);
            }
            if (Number(plan.sp_trial_days) > 0) {
              list.push(`${plan.sp_trial_days}-day free trial`);
            }

            const granted = plan.modules;
            list.push(CORE_NOTE);
            if (Array.isArray(granted)) {
              const optional = granted.filter((m) => !REQUIRED_MODULES.includes(m));
              optional.forEach((m) => list.push(moduleLabel(m)));
            }

            const extras = (plan.items || [])
              .filter((i) => i.spi_type === 'FEATURES')
              .map((i) => i.spi_details);
            extras.forEach((e) => {
              if (!list.includes(e)) list.push(e);
            });

            plan.features = list;
          });

          setPlans(plansWithItems);
          
          const planRestored = sessionStorage.getItem('planRestored');
          if (plansWithItems.length > 0 && !planRestored) {
            setSelectedPlan(plansWithItems[0]);
            setFormData(prev => ({
              ...prev,
              subscription_id: plansWithItems[0].sp_id,
              subscription_price: plansWithItems[0].price,
              subscription_billing_cycle: plansWithItems[0].billingCycle
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching subscription plans:', error);
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchSubscriptionPlans();
  }, []);

  // Filter plans based on used free trials
  useEffect(() => {
    if (plans.length === 0) return;

    const filtered = plans.filter(plan => {
      if (plan.price === 0 || plan.price === '0' || plan.price === '0.00') {
        return !usedFreeTrials.includes(plan.sp_id);
      }
      return true;
    });

    setFilteredPlans(filtered);

    if (selectedPlan && !filtered.find(p => p.sp_id === selectedPlan.sp_id)) {
      if (filtered.length > 0) {
        setSelectedPlan(filtered[0]);
        setFormData(prev => ({
          ...prev,
          subscription_id: filtered[0].sp_id,
          subscription_price: filtered[0].price,
          subscription_billing_cycle: filtered[0].billingCycle
        }));
      }
    }
  }, [plans, usedFreeTrials, selectedPlan]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePlanSelect = async (plan) => {
    const pendingUser = sessionStorage.getItem('pendingUser');
    const registeredUsername = sessionStorage.getItem('registeredUsername');

    const planPrice = calculatePrice(plan);
    if (planPrice === 0) {
      let username = null;
      if (pendingUser) {
        const userData = JSON.parse(pendingUser);
        username = userData.username;
      } else if (registeredUsername) {
        username = registeredUsername;
      } else {
        username = formData.username;
      }

      if (username) {
        try {
          const response = await fetch(SUBSCRIPTION_API.credentialsCheckFreeTrial(username));
          const data = await response.json();

          if (data.success && data.hasUsedFreeTrial) {
            setToastMessage('You have already used a free trial. Please select a paid plan.');
            setToastType('error');
            setShowToast(true);
            return;
          }
        } catch (error) {
          console.error('Error checking free trial usage:', error);
        }
      }
    }

    setSelectedPlan(plan);
    setFormData(prev => ({
      ...prev,
      subscription_id: plan.sp_id,
      subscription_price: plan.price,
      subscription_billing_cycle: plan.billingCycle
    }));
  };

  const calculatePrice = (plan) => {
    if (!plan) return 0;
    const numPrice = Number(plan.price) || 0;
    if (billingCycle === 'annual' && plan.billingCycle === 'Monthly') {
      return Math.floor(numPrice * 0.85);
    }
    return numPrice;
  };

  const calculateTotal = () => {
    if (!selectedPlan) return 0;
    const planPrice = calculatePrice(selectedPlan);
    const months = billingCycle === 'annual' ? 12 : 1;
    const extraSeats = Math.max(0, seats - 1);
    const seatPrice = 999; // ₱999 per extra seat per month
    const baseCost = planPrice * months;
    const seatsCost = extraSeats * seatPrice * months;
    const subtotal = baseCost + seatsCost;
    const discount = billingCycle === 'annual' ? Math.round(subtotal * 0.15) : 0;
    return subtotal - discount;
  };

  const fetchUsedFreeTrials = async (username) => {
    setLoadingUsedFreeTrials(true);
    try {
      const response = await fetch(SUBSCRIPTION_API.credentialsUsedFreeTrials(username));
      const data = await response.json();
      
      if (data.success) {
        setUsedFreeTrials(data.data);
      }
    } catch (error) {
      console.error('Error fetching used free trials:', error);
    } finally {
      setLoadingUsedFreeTrials(false);
    }
  };

  const handleSubmit = async () => {
    if (currentStep === 1) {
      // Step 1: Validate and submit organization & admin login
      if (!formData.username || !formData.password || !formData.company_name || !formData.email) {
        setToastMessage('Please fill in all required fields.');
        setToastType('error');
        setShowToast(true);
        return;
      }

      if (formData.password.length < 8) {
        setToastMessage('Password must be at least 8 characters.');
        setToastType('error');
        setShowToast(true);
        return;
      }

      if (!formData.email.includes('@') || !formData.email.includes('.')) {
        setToastMessage('Please enter a valid email address.');
        setToastType('error');
        setShowToast(true);
        return;
      }

      if (formData.username.length < 3) {
        setToastMessage('Username must be at least 3 characters.');
        setToastType('error');
        setShowToast(true);
        return;
      }

      // Move to step 2
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Step 2: Validate subscription selection
      if (!selectedPlan) {
        setToastMessage('Please select a subscription plan.');
        setToastType('error');
        setShowToast(true);
        return;
      }

      // Show review modal before proceeding
      setShowReviewModal(true);
    }
  };

  const handleConfirmAndProceed = async () => {
    setShowReviewModal(false);
    setPaymentLoading(true);

    const planPrice = calculatePrice(selectedPlan);
    const isTrial = planPrice === 0;
    const isExistingUser = !!pendingAccount?.username;

    console.log('handleConfirmAndProceed called', { planPrice, isTrial, isExistingUser, selectedPlan });

    if (isTrial) {
      // For free trials
      if (isExistingUser) {
        // Existing user - just update subscription directly
        try {
          let username = pendingAccount?.username;
          if (!username) {
            const pendingUser = sessionStorage.getItem('pendingUser');
            if (pendingUser) {
              const userData = JSON.parse(pendingUser);
              username = userData.username;
            }
          }

          let billingCycleDays = selectedPlan.billingCycle;
          if (typeof billingCycleDays === 'string') {
            const cycleMap = { 'week': 7, 'month': 30, 'year': 365 };
            billingCycleDays = cycleMap[billingCycleDays.toLowerCase()] || billingCycleDays;
          }
          
          await fetch(SUBSCRIPTION_API.credentialsSubscription(), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: username,
              subscription_id: selectedPlan.sp_id,
              subscription_price: planPrice,
              subscription_billing_cycle: billingCycleDays,
            }),
          });

          setPaymentLoading(false);
          setPaymentSuccessDetails({
            username: username,
            email: pendingAccount?.email || formData.email,
            companyName: formData.company_name,
            planName: selectedPlan?.sp_name,
            planPrice: 0,
            billingCycle: selectedPlan?.billingCycle,
            paymentMethod: 'Free Trial',
            paymentReference: 'N/A',
            isNewRegistration: false,
            isUpgrade: true
          });
          setShowConfirmation(true);
          return;
        } catch (error) {
          console.error('Error updating subscription for free plan:', error);
          setPaymentError('Failed to activate free plan. Please try again.');
          setPaymentLoading(false);
          return;
        }
      } else {
        // New user - register directly without payment
        const registrationData = {
          ...formData,
          subscription_id: selectedPlan?.sp_id || null,
          subscription_price: selectedPlan ? calculatePrice(selectedPlan) : null,
          subscription_billing_cycle: selectedPlan?.billingCycle || null,
        };
        
        console.log('Starting free trial registration', registrationData);
        const success = await register(registrationData);
        setPaymentLoading(false);
        if (success) {
          setPaymentSuccessDetails({
            username: formData.username,
            email: formData.email,
            companyName: formData.company_name,
            planName: selectedPlan?.sp_name,
            planPrice: 0,
            billingCycle: selectedPlan?.billingCycle,
            paymentMethod: 'Free Trial',
            paymentReference: 'N/A',
            isNewRegistration: true,
            isUpgrade: false
          });
          setShowConfirmation(true);
        }
      }
    } else {
      // For paid plans: PayMongo checkout FIRST
      try {
        let username = formData.username;
        let email = formData.email;
        let companyName = formData.company_name;

        // If existing user, get their info from pendingAccount
        if (isExistingUser) {
          username = pendingAccount?.username;
          email = pendingAccount?.email || formData.email;
          companyName = formData.company_name; // Company name from form
          
          // Store that this is an upgrade, not a new registration
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('isUpgrade', 'true');
          }
        }

        const checkoutData = {
          amount: calculatePrice(selectedPlan),
          description: `${selectedPlan.sp_name} - ${selectedPlan.billingCycle}`,
          username: username,
          email: email,
          company_name: companyName,
          subscription_id: selectedPlan.sp_id,
          subscription_billing_cycle: selectedPlan.billingCycle,
        };

        console.log('Requesting PayMongo checkout', checkoutData);
        console.log('Checkout URL:', SUBSCRIPTION_API.subscriptionPlansCheckout());

        const response = await fetch(SUBSCRIPTION_API.subscriptionPlansCheckout(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(checkoutData),
        });

        console.log('PayMongo response status:', response.status);

        const data = await response.json();
        console.log('PayMongo response data:', data);

        if (data.success) {
          // Store data in sessionStorage for post-payment processing
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('paymongoSessionId', data.data.session_id);
            sessionStorage.setItem('selectedPlanId', selectedPlan.sp_id.toString());
            
            if (!isExistingUser) {
              // Only store pendingRegistration for NEW users
              sessionStorage.setItem('pendingRegistration', JSON.stringify({
                ...formData,
                subscription_id: selectedPlan.sp_id,
                subscription_price: calculatePrice(selectedPlan),
                subscription_billing_cycle: selectedPlan.billingCycle,
              }));
            }
          }
          console.log('Redirecting to PayMongo checkout:', data.data.checkout_url);
          // Redirect to PayMongo - user will come back after payment
          window.location.href = data.data.checkout_url;
        } else {
          console.error('PayMongo checkout failed:', data);
          setPaymentError(data.message || 'Failed to create payment session');
          setPaymentLoading(false);
        }
      } catch (error) {
        console.error('Payment error:', error);
        setPaymentError(`Failed to process payment: ${error.message}`);
        setPaymentLoading(false);
      }
    }
  };

  const formatPHP = (num) => {
    return '₱' + num.toLocaleString('en-PH');
  };

  const getWorkspaceSlug = (companyName) => {
    const clean = companyName.trim();
    return clean
      ? clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : 'your-company';
  };

  const planPrice = selectedPlan ? calculatePrice(selectedPlan) : 0;
  const isTrial = planPrice === 0;
  const total = calculateTotal();

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-red-100 selection:text-red-700">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-sidebar-scrollbar::-webkit-scrollbar {
              width: 5px;
            }
            .custom-sidebar-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-sidebar-scrollbar::-webkit-scrollbar-thumb {
              background: #dc2626;
              border-radius: 10px;
            }
            .custom-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #b91c1c;
            }
          `,
        }}
      />
      <div className="min-h-screen flex flex-col lg:flex-row">

        {/* LEFT RAIL: WORKSPACE & LIVE RECEIPT SIDEBAR */}
        <aside className="lg:w-[42%] xl:w-[38%] bg-zinc-950 text-white lg:fixed lg:inset-y-0 lg:left-0 flex flex-col justify-between p-6 sm:p-10 lg:p-12 overflow-y-auto custom-sidebar-scrollbar border-b lg:border-b-0 lg:border-r border-zinc-800">
          
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center font-extrabold text-base tracking-tight">
                  5L
                </div>
                <div>
                  <div className="font-bold tracking-tight text-sm text-white">5L SOLUTIONS</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Cloud ERP & Accounting</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs font-medium text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <i className="fa-solid fa-arrow-left text-[10px]"></i>
                <span>Sign in</span>
              </button>
            </div>

            {/* Live Dynamic Workspace Preview Card */}
            <div className="rounded-2xl bg-white/10 border border-white/20 p-5 sm:p-6 space-y-5 shadow-2xl backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-300">Workspace Provisioning</div>
                  <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5 truncate max-w-[240px]">
                    {formData.company_name || 'Your Company Workspace'}
                  </h2>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">
                    app.5lsolutions.com/{getWorkspaceSlug(formData.company_name)}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-red-600/25 border border-red-500/50 text-red-300 text-[11px] font-semibold shrink-0">
                  {selectedPlan?.sp_name || 'Professional'}
                </span>
              </div>

              {/* Live Breakdown Line Items */}
              <div className="pt-4 border-t border-white/10 space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between text-zinc-200">
                  <span>{selectedPlan?.sp_name || 'Professional Plan'} ({billingCycle === 'annual' ? 'Annual' : 'Monthly'})</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {isTrial ? '₱0' : formatPHP(planPrice * (billingCycle === 'annual' ? 12 : 1))}
                  </span>
                </div>

                <div className="flex items-center justify-between text-zinc-300">
                  <span>
                    {seats === 1
                      ? '1 Admin User Included'
                      : `1 Admin + ${seats - 1} Extra User${seats - 1 > 1 ? 's' : ''}`}
                  </span>
                  <span className="font-mono text-emerald-400">
                    {isTrial ? '₱0' : formatPHP(Math.max(0, seats - 1) * 999 * (billingCycle === 'annual' ? 12 : 1))}
                  </span>
                </div>

                {billingCycle === 'annual' && !isTrial && (
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>Annual Savings (15% Off)</span>
                    <span className="font-mono font-semibold">
                      -{formatPHP(Math.round((planPrice * 12 + Math.max(0, seats - 1) * 999 * 12) * 0.15))}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-zinc-400 text-xs">
                  <span>Philippine VAT (12% Inclusive)</span>
                  <span>Included</span>
                </div>
              </div>

              {/* Total Due Box */}
              <div className="pt-4 border-t border-white/10 flex items-baseline justify-between">
                <div>
                  <div className="text-xs font-medium text-zinc-300">Due today</div>
                  <div className="text-[11px] text-zinc-400">
                    {isTrial ? 'No credit card required' : `Billed ${billingCycle === 'annual' ? 'annually' : 'monthly'} via PayMongo`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400 tracking-tight">
                    {isTrial ? '₱0' : formatPHP(total)}
                  </div>
                </div>
              </div>
            </div>

            {/* Included Highlights for Selected Plan */}
            <div className="hidden lg:block space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-300">Included in selected tier</div>
              <div className="rounded-2xl bg-white/10 border border-white/20 p-4 sm:p-5 backdrop-blur-sm">
                <ul className="space-y-2.5 text-xs text-zinc-200">
                  {(selectedPlan?.features || [
                    'Automated BIR Tax Returns (VAT & Withholding)',
                    'Bank Reconciliation, Aging AP/AR & Cash Flow',
                    'Full Audit Trail & Accounting Period Locks'
                  ]).map((feat, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <i className="fa-solid fa-check text-red-400 text-xs"></i>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Security Footer */}
          <div className="hidden lg:flex items-center justify-between pt-8 mt-8 border-t border-zinc-800/80 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <i className="fa-solid fa-shield-halved text-emerald-500"></i>
              BIR-Ready & 256-Bit Encrypted
            </span>
            <span>PayMongo Verified</span>
          </div>
        </aside>

        {/* RIGHT CANVAS: UNIFIED SINGLE-PAGE INTERACTIVE SETUP FLOW */}
        <main className="lg:ml-[42%] xl:ml-[38%] flex-1 bg-slate-50/70 min-h-screen py-10 sm:py-5 px-5 sm:px-10 lg:px-14 xl:px-20">
          
          {/* Confirmation View */}
          {showConfirmation ? (
            <div className="max-w-xl mx-auto py-12 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
                <i className="fa-solid fa-check"></i>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                  {paymentSuccessDetails?.isNewRegistration ? 'Registration Successful!' : 'Payment Successful!'}
                </h2>
                <p className="text-sm text-slate-500">
                  {paymentSuccessDetails?.isNewRegistration
                    ? 'Your account has been created and payment verified.'
                    : paymentSuccessDetails?.isUpgrade
                      ? 'Your subscription has been upgraded successfully.'
                      : 'Payment verified! Your subscription is now active.'}
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 text-left text-xs space-y-4">
                <div className="space-y-3">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100">
                    Account Details
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Username</span>
                    <span className="font-bold text-slate-900">{paymentSuccessDetails?.username || formData.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email</span>
                    <span className="font-bold text-slate-900">{paymentSuccessDetails?.email || formData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Organization</span>
                    <span className="font-bold text-slate-900">{paymentSuccessDetails?.companyName || formData.company_name}</span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100">
                    Subscription Details
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Plan</span>
                    <span className="font-bold text-red-600">{paymentSuccessDetails?.planName || selectedPlan?.sp_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount Paid</span>
                    <span className="font-bold text-slate-900">{formatPHP(paymentSuccessDetails?.planPrice || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Billing Cycle</span>
                    <span className="font-bold text-slate-900">
                      {paymentSuccessDetails?.billingCycle
                        ? `${paymentSuccessDetails.billingCycle} days`
                        : selectedPlan?.billingCycle || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100">
                    Payment Details
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Method</span>
                    <span className="font-bold text-slate-900 capitalize">
                      {paymentSuccessDetails?.paymentMethod || 'PayMongo'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reference ID</span>
                    <span className="font-mono text-slate-700 text-[10px]">
                      {paymentSuccessDetails?.paymentReference || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider transition-all"
              >
                Go to Login
              </button>
            </div>
          ) : (
            /* Main Setup Form Container */
            <div className="max-w-2xl mx-auto space-y-10">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
                  {currentStep === 1
                    ? 'Set up your 5L Solutions account'
                    : 'Choose your subscription plan'}
                </h1>
                <p className="text-sm text-slate-500 mt-1.5">
                  {currentStep === 1
                    ? 'Complete your organization details and admin credentials below.'
                    : 'Select a subscription tier that fits your business needs.'}
                </p>
              </div>

              {pendingAccount?.username && (
                <div className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                    <i className="fa-solid fa-user text-sm"></i>
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-black text-slate-900">
                      {pendingAccount.fullname || pendingAccount.username}
                      {pendingAccount.existingAccount && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 align-middle text-[10px] font-black uppercase tracking-wide text-emerald-700">
                          Existing account
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {pendingAccount.email || `@${pendingAccount.username}`}
                      {pendingAccount.tenantDb && (
                        <span className="ml-2 text-slate-400">({pendingAccount.tenantDb})</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              <form className="space-y-10" novalidate>

                {/* SECTION A: ORGANIZATION & ADMIN CREDENTIALS - STEP 1 */}
                {currentStep === 1 && !pendingAccount?.username && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Organization & Admin Login</h2>
                      <span className="ml-auto text-xs text-slate-400">Step 1 of 2</span>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                      {/* Company Name */}
                      <div>
                        <label htmlFor="company_name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Registered Company Name
                        </label>
                        <input
                          type="text"
                          id="company_name"
                          name="company_name"
                          value={formData.company_name}
                          onChange={handleChange}
                          placeholder="e.g., Acme Trading Philippines Inc."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 transition-all"
                        />
                      </div>

                      {/* Email & Username Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Work Email
                          </label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="finance@company.com"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 transition-all"
                          />
                        </div>

                        <div>
                          <label htmlFor="username" className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Admin Username
                          </label>
                          <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="johndoe"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 transition-all"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                            Password
                          </label>
                          <span className="text-[11px] text-slate-400">
                            {formData.password.length < 8
                              ? `${8 - formData.password.length} more characters needed`
                              : 'Strong password ✓'}
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••••••"
                            className="w-full px-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700"
                          >
                            <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION B: PLAN SELECTOR - STEP 2 */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="w-6 h-6 rounded-full bg-zinc-200 text-zinc-600 text-xs font-bold flex items-center justify-center hover:bg-zinc-300 transition-colors"
                        >
                          <i className="fa-solid fa-arrow-left text-[10px]"></i>
                        </button>
                        <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Select Subscription Tier</h2>
                        <span className="ml-auto text-xs text-slate-400">Step 2 of 2</span>
                      </div>

                      {/* Billing Switch */}
                      <div className="inline-flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setBillingCycle('monthly')}
                          className={`px-3 py-1.5 rounded-lg transition-all ${
                            billingCycle === 'monthly'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Monthly
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingCycle('annual')}
                          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                            billingCycle === 'annual'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>Annual</span>
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">-15%</span>
                        </button>
                      </div>
                    </div>

                  {loadingPlans ? (
                    <div className="py-12 text-center">
                      <i className="fa-solid fa-circle-notch fa-spin text-red-600 text-3xl mb-3"></i>
                      <p className="text-sm font-semibold text-slate-500">Loading plans...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredPlans.map((plan) => {
                        const isSelected = selectedPlan?.sp_id === plan.sp_id;
                        const price = calculatePrice(plan);
                        const isPlanTrial = price === 0;

                        return (
                          <div
                            key={plan.sp_id}
                            onClick={() => handlePlanSelect(plan)}
                            className={`cursor-pointer rounded-2xl bg-white border-2 p-4 sm:p-5 transition-all flex items-center justify-between gap-4 ${
                              isSelected 
                                ? 'border-red-600 ring-4 ring-red-600/10' 
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start gap-3.5">
                              <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-red-600' : 'border-slate-300'
                              }`}>
                                <div className={`w-2.5 h-2.5 rounded-full bg-red-600 ${isSelected ? '' : 'hidden'}`}></div>
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-950 text-sm sm:text-base">{plan.sp_name}</span>
                                  {isPlanTrial && (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                                      7-Day Free Trial
                                    </span>
                                  )}
                                  {plan.popular && !isPlanTrial && (
                                    <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                                      Recommended
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                  {plan.sp_description || plan.features?.join(', ')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-950">
                                {isPlanTrial ? '₱0' : formatPHP(price)}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {isPlanTrial ? 'for 7 days' : `/ ${plan.billingCycle?.toLowerCase()}`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Feature Matrix Accordion */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowFeatureMatrix(!showFeatureMatrix)}
                      className="text-xs font-semibold text-slate-600 hover:text-red-600 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <i className={`fa-solid fa-chevron-right text-[10px] transition-transform ${showFeatureMatrix ? 'rotate-90' : ''}`}></i>
                      <span>Compare all 17 accounting & tax modules</span>
                    </button>

                    {showFeatureMatrix && (
                      <div className="mt-3 rounded-2xl bg-white border border-slate-200 p-5 text-xs space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-slate-600">
                          <div className="flex items-center gap-2"><i className="fa-solid fa-check text-red-600"></i> Core Accounting & Journal Entries</div>
                          <div className="flex items-center gap-2"><i className="fa-solid fa-check text-red-600"></i> Financial Reporting & Cash Flow</div>
                          <div className="flex items-center gap-2"><i className="fa-solid fa-check text-red-600"></i> Tax Compliance (BIR Returns & VAT)</div>
                          <div className="flex items-center gap-2"><i className="fa-solid fa-check text-red-600"></i> Withholding Tax Management</div>
                          <div className="flex items-center gap-2"><i className="fa-solid fa-check text-red-600"></i> Aging Payables & Receivables</div>
                          <div className="flex items-center gap-2"><i className="fa-solid fa-check text-red-600"></i> Bank Reconciliation & Advances</div>
                          <div className="flex items-center gap-2"><i className="fa-solid fa-check text-red-600"></i> Purchase Orders & Products/Services</div>
                          <div className="flex items-center gap-2"><i className="fa-solid fa-check text-red-600"></i> Audit Trail, Recurring Journals & Periods</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* SECTION C: TEAM SEATS & PAYMENT */}
                {currentStep === 2 && !isTrial && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">3</span>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Team Size & Checkout</h2>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 space-y-5">
                      {/* Team Seats Stepper */}
                      <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-100">
                        <div>
                          <div className="text-sm font-bold text-slate-900">Workspace User Seats</div>
                          <div className="text-xs text-slate-500">1 Admin included • Additional users at ₱999/mo each</div>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setSeats(Math.max(1, seats - 1))}
                            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-50 text-slate-800 font-bold shadow-2xs"
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-mono text-sm font-bold text-slate-950">{seats}</span>
                          <button
                            type="button"
                            onClick={() => setSeats(Math.min(50, seats + 1))}
                            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-50 text-slate-800 font-bold shadow-2xs"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* PayMongo Channels */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">
                          You will be redirected to <strong className="text-slate-800">PayMongo</strong> secure checkout:
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200">GCash</span>
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200">Maya</span>
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200">Cards</span>
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200">BPI / UnionBank</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Action Area */}
                <div className="pt-2 space-y-3">
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-3 font-bold">
                      <i className="fa-solid fa-circle-exclamation text-red-600"></i>
                      <span>{error}</span>
                    </div>
                  )}

                  {paymentError && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-3 font-bold">
                      <i className="fa-solid fa-circle-exclamation text-red-600"></i>
                      <span>{paymentError}</span>
                    </div>
                  )}

                  {!pendingAccount?.username ? (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={paymentLoading}
                      className="w-full py-4 px-6 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-bold text-sm tracking-wide shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
                    >
                      <i className={`fa-solid ${paymentLoading ? 'fa-circle-notch fa-spin' : 'fa-arrow-right'} text-xs`}></i>
                      <span>
                        {paymentLoading
                          ? 'Processing...'
                          : currentStep === 1
                            ? 'Continue to Plan Selection'
                            : isTrial
                              ? 'START 7-DAY FREE TRIAL NOW'
                              : `CREATE ACCOUNT & PAY ${formatPHP(total)} VIA PAYMONGO`}
                      </span>
                      <i className="fa-solid fa-arrow-right text-xs"></i>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConfirmAndProceed}
                      disabled={paymentLoading || !selectedPlan}
                      className="w-full py-4 px-6 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white font-bold text-sm tracking-wide shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
                    >
                      <i className={`fa-solid ${paymentLoading ? 'fa-circle-notch fa-spin' : 'fa-lock'} text-xs`}></i>
                      <span>
                        {paymentLoading
                          ? 'Processing Payment...'
                          : isTrial
                            ? 'START 7-DAY FREE TRIAL NOW'
                            : `PAY ${formatPHP(total)} VIA PAYMONGO`}
                      </span>
                      <i className="fa-solid fa-arrow-right text-xs"></i>
                    </button>
                  )}

                  <p className="text-center text-xs text-slate-400">
                    By creating an account, you agree to 5L Solutions' Terms of Service & Privacy Policy.
                  </p>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Toast Banner */}
      {showToast && (
        <div className="fixed bottom-5 right-5 z-50 transform transition-all duration-300">
          <div className={`bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-xl border border-zinc-700 flex items-center gap-2.5 text-xs font-medium ${
            toastType === 'error' ? 'border-red-600' : ''
          }`}>
            <i className={`fa-solid ${toastType === 'error' ? 'fa-circle-exclamation text-red-400' : 'fa-circle-info text-sky-400'}`}></i>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto text-2xl mb-4">
                <i className="fa-solid fa-receipt"></i>
              </div>
              <h3 className="text-xl font-bold text-black mb-2">Review Your Order</h3>
              <p className="text-sm text-slate-500">Please confirm your details before proceeding</p>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Company</span>
                  <span className="font-bold text-slate-900">{formData.company_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Email</span>
                  <span className="font-bold text-slate-900">{formData.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Username</span>
                  <span className="font-bold text-slate-900">{formData.username}</span>
                </div>
                <div className="border-t border-slate-200 pt-3 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Plan</span>
                    <span className="font-bold text-slate-900">{selectedPlan?.sp_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Billing</span>
                    <span className="font-bold text-slate-900 capitalize">{billingCycle}</span>
                  </div>
                  {!isTrial && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">User Seats</span>
                      <span className="font-bold text-slate-900">{seats} user{seats > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-slate-200">
                <div>
                  <div className="text-sm font-bold text-slate-900">Total Due Today</div>
                  <div className="text-xs text-slate-500">
                    {isTrial ? 'No credit card required' : `Billed ${billingCycle === 'annual' ? 'annually' : 'monthly'}`}
                  </div>
                </div>
                <div className="text-2xl font-extrabold font-mono text-slate-900">
                  {isTrial ? '₱0' : formatPHP(total)}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm transition-all"
              >
                <i className="fa-solid fa-arrow-left mr-2"></i>
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmAndProceed}
                disabled={paymentLoading}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {paymentLoading ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Processing...
                  </>
                ) : isTrial ? (
                  <>
                    <i className="fa-solid fa-rocket"></i>
                    Start Free Trial
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-lock"></i>
                    Pay {formatPHP(total)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 border-4 border-red-600/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h3 className="text-xl font-bold text-black mb-2">Setting Up Your Account</h3>
              <p className="text-sm text-gray-600">{progress.message || 'Initializing...'}</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                <span>Progress</span>
                <span>{progress.progress || 0}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-300 ease-out"
                  style={{ width: `${progress.progress || 0}%` }}
                />
              </div>
              
              <div className="mt-4 space-y-2">
                <div className={`flex items-center gap-2 text-xs ${progress.progress >= 10 ? 'text-green-600' : 'text-gray-400'}`}>
                  <i className={`fa-solid fa-circle-check ${progress.progress >= 10 ? '' : 'fa-regular'}`}></i>
                  <span>Validating information</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${progress.progress >= 15 ? 'text-green-600' : 'text-gray-400'}`}>
                  <i className={`fa-solid fa-circle-check ${progress.progress >= 15 ? '' : 'fa-regular'}`}></i>
                  <span>Creating account</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${progress.progress >= 20 ? 'text-green-600' : 'text-gray-400'}`}>
                  <i className={`fa-solid fa-circle-check ${progress.progress >= 20 ? '' : 'fa-regular'}`}></i>
                  <span>Creating database</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${progress.progress >= 60 ? 'text-green-600' : 'text-gray-400'}`}>
                  <i className={`fa-solid fa-circle-check ${progress.progress >= 60 ? '' : 'fa-regular'}`}></i>
                  <span>Running migrations</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${progress.progress >= 85 ? 'text-green-600' : 'text-gray-400'}`}>
                  <i className={`fa-solid fa-circle-check ${progress.progress >= 85 ? '' : 'fa-regular'}`}></i>
                  <span>Running seeders</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${progress.progress >= 90 ? 'text-green-600' : 'text-gray-400'}`}>
                  <i className={`fa-solid fa-circle-check ${progress.progress >= 90 ? '' : 'fa-regular'}`}></i>
                  <span>Setting up user account</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
