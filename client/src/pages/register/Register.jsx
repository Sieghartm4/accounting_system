import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  User, 
  Mail,
  Building2, 
  ArrowRight, 
  Loader2, 
  ShieldCheck, 
  PieChart, 
  Eye, 
  EyeOff, 
  Check, 
  Star, 
  Zap, 
  Sparkles, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft,
  Globe2,
  CheckCircle
} from 'lucide-react';
import useRegister from './useRegister';
import DynamicToast from '../../components/DynamicToast';

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
  const [step, setStep] = useState(1); // Step 1: Account Creation, Step 2: Plan Selection, Step 3: Payment
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('warning');
  const [usedFreeTrials, setUsedFreeTrials] = useState([]);
  const [loadingUsedFreeTrials, setLoadingUsedFreeTrials] = useState(false);

  const { register, loading, error, registerData, progress } = useRegister();

  useEffect(() => {
    // Restore selected plan from sessionStorage if it exists
    if (typeof window !== 'undefined') {
      const storedPlanId = sessionStorage.getItem('selectedPlanId');
      console.log('Stored plan ID:', storedPlanId);
      console.log('Available plans:', plans.map(p => ({ id: p.sp_id, name: p.sp_name })));
      console.log('Current selectedPlan:', selectedPlan);
      
      if (storedPlanId && plans.length > 0) {
        // Convert stored ID to number for comparison with plan IDs
        const matchedPlan = plans.find(p => p.sp_id === parseInt(storedPlanId));
        console.log('Matched plan:', matchedPlan);
        console.log('Matched plan ID type:', typeof matchedPlan?.sp_id);
        console.log('Stored ID type:', typeof storedPlanId);
        
        if (matchedPlan) {
          setSelectedPlan(matchedPlan);
          setFormData(prev => ({
            ...prev,
            subscription_id: matchedPlan.sp_id,
            subscription_price: matchedPlan.price,
            subscription_billing_cycle: matchedPlan.billingCycle
          }));
          // Clear stored plan after successful restoration
          sessionStorage.removeItem('selectedPlanId');
          // Set a flag to prevent default selection from overriding
          sessionStorage.setItem('planRestored', 'true');
        } else {
          // Plan not found, clear sessionStorage to prevent infinite loop
          sessionStorage.removeItem('selectedPlanId');
        }
      }
    }
  }, [plans, selectedPlan]);

  useEffect(() => {
    // Check if user is coming from login without subscription
    if (typeof window !== 'undefined') {
      const queryParams = new URLSearchParams(window.location.search);
      const stepParam = queryParams.get('step');
      const pendingUser = sessionStorage.getItem('pendingUser');
      
      if (stepParam === 'plan' && pendingUser) {
        // User is coming from login without subscription - skip to plan selection
        const userData = JSON.parse(pendingUser);
        setFormData(prev => ({
          ...prev,
          username: userData.username,
          password: userData.password
        }));
        setStep(2); // Skip to plan selection
        
        // Show toast notification
        setToastMessage('You do not have an active subscription. Please complete your registration by selecting a subscription plan.');
        setToastType('warning');
        setShowToast(true);
        
        // Fetch user's used free trials
        fetchUsedFreeTrials(userData.username);
      }
    }
  }, []);

  // Validate that user has an account before allowing step 2 or 3
  useEffect(() => {
    if (step > 1) {
      const pendingUser = sessionStorage.getItem('pendingUser');
      const registeredUsername = sessionStorage.getItem('registeredUsername');
      
      if (!pendingUser && !registeredUsername && !formData.username) {
        // User doesn't have an account, redirect to step 1
        setToastMessage('Please create an account first.');
        setToastType('error');
        setShowToast(true);
        setStep(1);
      }
    }
  }, [step]);

  useEffect(() => {
    // Handle payment status separately (always run this)
    // Step 1: Account Creation, Step 2: Plan Selection, Step 3: Payment
    if (typeof window !== 'undefined') {
      const queryParams = new URLSearchParams(window.location.search);
      const paymentParam = queryParams.get('payment');
      
      if (paymentParam === 'success') {
        // Check if we've already processed this payment
        const paymentProcessed = sessionStorage.getItem('paymentProcessed');
        if (paymentProcessed) {
          console.log('Payment already processed, skipping');
          return;
        }
        
        // Mark payment as processed
        sessionStorage.setItem('paymentProcessed', 'true');
        
        // After successful payment, update user's subscription_id
        const updateSubscription = async () => {
          try {
            console.log('Payment success detected, updating subscription...');
            const pendingUser = sessionStorage.getItem('pendingUser');
            const storedPlanId = sessionStorage.getItem('selectedPlanId');
            const sessionId = sessionStorage.getItem('paymongoSessionId') || queryParams.get('session_id');
            const paymentReference = queryParams.get('payment_id') || queryParams.get('source_id') || queryParams.get('payment_intent');
            
            console.log('Pending user:', pendingUser);
            console.log('Stored plan ID:', storedPlanId);
            console.log('Session ID:', sessionId);
            console.log('Payment reference:', paymentReference);
            
            let username = null;
            if (pendingUser) {
              const userData = JSON.parse(pendingUser);
              username = userData.username;
            } else {
              username = sessionStorage.getItem('registeredUsername');
            }
            
            console.log('Username for subscription update:', username);
            
            const subscriptionUrl = import.meta.env.VITE_SUBSCRIPTION_LINK;
            
            // Initialize variables for subscription history
            let paymentMethod = 'paymongo';
            let actualPaymentReference = paymentReference;
            let planPrice = 0;
            let billingCycleDays = null;
            
            // Fetch payment details from PayMongo if session_id is available
            
            if (sessionId && sessionId !== '{CHECKOUT_SESSION_ID}') {
              try {
                console.log('Fetching payment details from PayMongo for session:', sessionId);
                const paymentDetailsResponse = await fetch(`${subscriptionUrl}/subscription-plans/payment-details/${sessionId}`);
                const paymentDetailsData = await paymentDetailsResponse.json();
                console.log('Payment details from PayMongo:', paymentDetailsData);
                
                if (paymentDetailsData.success && paymentDetailsData.data) {
                  paymentMethod = paymentDetailsData.data.payment_method || 'paymongo';
                  actualPaymentReference = paymentDetailsData.data.payment_reference || sessionId;
                  // Use amount and billing cycle from payment details if available
                  if (paymentDetailsData.data.amount) {
                    planPrice = paymentDetailsData.data.amount;
                    console.log('Using price from payment details:', planPrice);
                  }
                  if (paymentDetailsData.data.billing_cycle) {
                    billingCycleDays = paymentDetailsData.data.billing_cycle;
                    console.log('Using billing cycle from payment details:', billingCycleDays);
                  }
                  console.log('Payment method:', paymentMethod, 'Reference:', actualPaymentReference);
                } else {
                  console.error('Payment details fetch failed:', paymentDetailsData.message);
                }
              } catch (error) {
                console.error('Error fetching payment details:', error);
              }
            } else {
              console.log('No valid session_id found in URL, using default payment method');
            }
            
            if (username && storedPlanId) {
              
              // Fetch plan details to get price and billing cycle
              console.log('Fetching plan details for subscription history...');
              let storedPlan = null;
              
              // Retry fetching plans if initial attempt fails
              let retryCount = 0;
              while (retryCount < 3 && !storedPlan) {
                try {
                  const plansResponse = await fetch(`${subscriptionUrl}/subscription-plans`);
                  const plansData = await plansResponse.json();
                  console.log(`Fetched plans data (attempt ${retryCount + 1}):`, plansData);
                  console.log('Plans data array:', plansData.data);
                  if (plansData.data && plansData.data.length > 0) {
                    console.log('First plan structure:', plansData.data[0]);
                  }
                  storedPlan = plansData.data?.find(p => p.sp_id === parseInt(storedPlanId));
                  console.log('Found stored plan:', storedPlan);
                } catch (fetchError) {
                  console.error(`Error fetching plans (attempt ${retryCount + 1}):`, fetchError);
                  retryCount++;
                  if (retryCount < 3) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                }
              }
              
              if (storedPlan) {
                // Only use plan price if payment details didn't provide one
                if (planPrice === 0 || planPrice === null) {
                  planPrice = storedPlan.sp_price || 0;
                  console.log('Plan sp_price:', planPrice);
                } else {
                  console.log('Using price from payment details:', planPrice);
                }
                
                // Only use plan billing cycle if payment details didn't provide one
                if (billingCycleDays === null) {
                  if (storedPlan.items && storedPlan.items.length > 0) {
                    const billingCycleItem = storedPlan.items.find(item => item.spi_type === 'BILLING_CYCLE');
                    if (billingCycleItem) {
                      billingCycleDays = parseInt(billingCycleItem.spi_details);
                      console.log('Billing cycle from items:', billingCycleDays);
                    }
                  }
                } else {
                  console.log('Using billing cycle from payment details:', billingCycleDays);
                }
                
                console.log('Final plan price:', planPrice, 'Final billing cycle:', billingCycleDays);
              } else {
                console.log('Plan not found after retries, using payment details values');
              }
              
              // Update subscription with history details
              console.log('Updating subscription for user:', username, 'with plan:', storedPlanId);
              console.log('Sending to backend - planPrice:', planPrice, 'billingCycleDays:', billingCycleDays, 'paymentMethod:', paymentMethod, 'actualPaymentReference:', actualPaymentReference);
              await fetch(`${subscriptionUrl}/credentials/subscription`, {
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
              
              console.log('Subscription updated successfully');
            } else {
              console.log('Missing username or storedPlanId');
            }
          } catch (error) {
            console.error('Error updating subscription:', error);
          } finally {
            // Clear all sessionStorage and redirect to login
            sessionStorage.removeItem('paymentStatus');
            sessionStorage.removeItem('selectedPlanId');
            sessionStorage.removeItem('planRestored');
            sessionStorage.removeItem('registeredUsername');
            sessionStorage.removeItem('pendingUser');
            sessionStorage.removeItem('paymentProcessed');
            sessionStorage.removeItem('paymongoSessionId');
            navigate('/login');
          }
        };
        
        updateSubscription();
      } else if (paymentParam === 'failed') {
        setPaymentError('Payment failed or was canceled. Please try again.');
        setStep(3); // Stay on payment step
        // Store payment status in sessionStorage for page refresh handling
        sessionStorage.setItem('paymentStatus', 'failed');
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        // Check for stored payment status (for page refresh scenario)
        const storedPaymentStatus = sessionStorage.getItem('paymentStatus');
        if (storedPaymentStatus === 'failed') {
          setPaymentError('Payment failed or was canceled. Please try again.');
          setStep(3);
        }
      }
    }
  }, []);

  useEffect(() => {
    const fetchSubscriptionPlans = async () => {
      try {
        const subscriptionUrl = import.meta.env.VITE_SUBSCRIPTION_LINK || 'http://192.168.40.241:3012';
        const response = await fetch(`${subscriptionUrl}/subscription-plans/public`);
        const data = await response.json();

        if (data.success && data.data) {
          const plansWithItems = data.data.map((plan) => {
            const features = [];
            
            if (plan.items && Array.isArray(plan.items)) {
              plan.items.forEach((item) => {
                if (item.spi_type === 'MODULES') {
                  features.push(item.spi_details);
                } else if (item.spi_type === 'FEATURES') {
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
                    if (days === 7) {
                      formattedCycle = 'week';
                    } else if (days === 30 || days === 31) {
                      formattedCycle = 'month';
                    } else if (days === 60 || days === 61) {
                      formattedCycle = '2 months';
                    } else if (days === 90 || days === 91) {
                      formattedCycle = '3 months';
                    } else if (days === 180 || days === 182) {
                      formattedCycle = '6 months';
                    } else if (days === 365 || days === 366) {
                      formattedCycle = 'year';
                    } else {
                      formattedCycle = `${cycle} days`;
                    }
                  }
                  
                  plan.billingCycle = formattedCycle;
                } else if (item.spi_type === 'PRICE') {
                  plan.price = item.spi_details;
                }
              });
            }
            
            plan.features = features;
            return plan;
          });

          setPlans(plansWithItems);
          
          // Only set default plan if no plan was restored from sessionStorage
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
      // If plan has price 0, check if it's in used free trials
      if (plan.price === 0 || plan.price === '0' || plan.price === '0.00') {
        return !usedFreeTrials.includes(plan.sp_id);
      }
      return true;
    });

    console.log('All plans:', plans.map(p => ({ id: p.sp_id, name: p.sp_name, price: p.price })));
    console.log('Used free trials:', usedFreeTrials);
    console.log('Filtered plans (excluding used free trials):', filtered.map(p => ({ id: p.sp_id, name: p.sp_name, price: p.price })));
    setFilteredPlans(filtered);

    // Update selected plan if it was filtered out
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
    // Check if user has an account (either from registration or login redirect)
    const pendingUser = sessionStorage.getItem('pendingUser');
    const registeredUsername = sessionStorage.getItem('registeredUsername');
    
    if (!pendingUser && !registeredUsername && !formData.username) {
      setToastMessage('Please create an account first before selecting a plan.');
      setToastType('error');
      setShowToast(true);
      setStep(1); // Go back to account creation
      return;
    }

    // Check if plan is free trial (price = 0)
    const planPrice = calculatePrice(plan);
    if (planPrice === 0) {
      // Check if user has already used a free trial
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
          const subscriptionUrl = import.meta.env.VITE_SUBSCRIPTION_LINK || 'http://192.168.40.241:3012';
          const response = await fetch(`${subscriptionUrl}/credentials/check-free-trial?username=${username}`);
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
    // If the plan's billing cycle is annual and user selected annual, use the price as-is
    // If the plan's billing cycle is monthly and user selected annual, apply discount
    if (billingCycle === 'annual' && plan.billingCycle === 'Monthly') {
      return Math.floor(numPrice * 0.85);
    }
    return numPrice;
  };

  const handleBackToPlans = () => {
    setStep(2);
    setPaymentError(null);
    // Clear payment status and pendingUser when going back to plans
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('paymentStatus');
      sessionStorage.removeItem('pendingUser');
      sessionStorage.removeItem('selectedPlanId');
      sessionStorage.removeItem('planRestored');
    }
  };

  const fetchUsedFreeTrials = async (username) => {
    setLoadingUsedFreeTrials(true);
    try {
      const subscriptionUrl = import.meta.env.VITE_SUBSCRIPTION_LINK || 'http://192.168.40.241:3012';
      const response = await fetch(`${subscriptionUrl}/credentials/used-free-trials?username=${username}`);
      const data = await response.json();
      console.log('Used free trials data:', data);
      
      if (data.success) {
        setUsedFreeTrials(data.data);
        console.log('Used free trial subscription IDs:', data.data);
      }
    } catch (error) {
      console.error('Error fetching used free trials:', error);
    } finally {
      setLoadingUsedFreeTrials(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedPlan) {
      setPaymentError('Please select a plan');
      return;
    }

    // Get username from sessionStorage (either from pendingUser or registeredUsername)
    let username = null;
    const pendingUser = sessionStorage.getItem('pendingUser');
    const registeredUsername = sessionStorage.getItem('registeredUsername');

    if (pendingUser) {
      const userData = JSON.parse(pendingUser);
      username = userData.username;
    } else if (registeredUsername) {
      username = registeredUsername;
    }

    if (!username) {
      setPaymentError('User session expired. Please register again.');
      navigate('/register');
      return;
    }

    // Store selected plan ID in sessionStorage for restoration after payment redirect
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selectedPlanId', selectedPlan.sp_id);
    }

    setPaymentLoading(true);
    setPaymentError(null);

    // Check if plan is free (₱0)
    const planPrice = calculatePrice(selectedPlan);
    console.log('handlePayment - Plan price:', planPrice, 'Type:', typeof planPrice);
    console.log('handlePayment - Selected plan:', selectedPlan);
    
    if (planPrice === 0 || planPrice === '0') {
      // For free plans, skip PayMongo and directly update subscription
      try {
        const subscriptionUrl = import.meta.env.VITE_SUBSCRIPTION_LINK || 'http://192.168.40.241:3012';
        
        // Update subscription with history details
        // Convert billing cycle to days if it's in human-readable format
        let billingCycleDays = selectedPlan.billingCycle;
        if (typeof billingCycleDays === 'string') {
          const cycleMap = { 'week': 7, 'month': 30, 'year': 365 };
          billingCycleDays = cycleMap[billingCycleDays.toLowerCase()] || billingCycleDays;
        }
        
        const planPrice = calculatePrice(selectedPlan);
        
        await fetch(`${subscriptionUrl}/credentials/subscription`, {
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

        // Clear sessionStorage and redirect to login
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('paymentStatus');
          sessionStorage.removeItem('selectedPlanId');
          sessionStorage.removeItem('planRestored');
          sessionStorage.removeItem('registeredUsername');
          sessionStorage.removeItem('pendingUser');
        }

        setPaymentLoading(false);
        navigate('/login');
        return;
      } catch (error) {
        console.error('Error updating subscription for free plan:', error);
        setPaymentError('Failed to activate free plan. Please try again.');
        setPaymentLoading(false);
        return;
      }
    }

    try {
      const subscriptionUrl = import.meta.env.VITE_SUBSCRIPTION_LINK || 'http://192.168.40.241:3012';
      const response = await fetch(`${subscriptionUrl}/subscription-plans/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: calculatePrice(selectedPlan),
          description: `${selectedPlan.sp_name} - ${selectedPlan.billingCycle}`,
          username: username,
          email: formData.email,
          company_name: formData.company_name,
          subscription_id: selectedPlan.sp_id,
          subscription_billing_cycle: selectedPlan.billingCycle,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Store session_id in sessionStorage for payment details retrieval
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('paymongoSessionId', data.data.session_id);
        }
        // Redirect to PayMongo checkout
        window.location.href = data.data.checkout_url;
      } else {
        setPaymentError(data.message || 'Failed to create payment session');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentError('Failed to process payment. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form fields
    if (!formData.username || !formData.password || !formData.company_name || !formData.email) {
      setToastMessage('Please fill in all required fields.');
      setToastType('error');
      setShowToast(true);
      return;
    }
    
    // Prepare registration data with subscription details if a plan is selected
    const registrationData = {
      ...formData,
      subscription_id: selectedPlan?.sp_id || null,
      subscription_price: selectedPlan ? calculatePrice(selectedPlan) : null,
      subscription_billing_cycle: selectedPlan?.billingCycle || null,
    };
    
    const success = await register(registrationData);
    if (success) {
      setStep(2); // Move to plan selection after successful registration
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-red-600 selection:text-white">
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center font-black text-xl shadow-md border-b-2 border-red-600">
              5L
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-black block leading-none">
                5L SOLUTIONS
              </span>
              <span className="text-[11px] tracking-wider text-red-600 uppercase font-bold">
                Enterprise SaaS Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 p-1.5 rounded-full border border-slate-200">
              <button 
                type="button"
                onClick={() => setStep(1)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  step === 1 ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : 'text-slate-600 hover:text-black'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-white text-red-600' : 'bg-slate-300 text-slate-800'}`}>1</span>
                Account
              </button>
              <ChevronRight size={14} className="text-slate-400" />
              <button 
                type="button"
                onClick={() => setStep(2)}
                disabled={step < 1 || (!formData.username && !sessionStorage.getItem('pendingUser') && !sessionStorage.getItem('registeredUsername'))}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  step === 2 ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : step >= 1 && (formData.username || sessionStorage.getItem('pendingUser') || sessionStorage.getItem('registeredUsername')) ? 'text-slate-600 hover:text-black' : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-white text-red-600' : step >= 1 ? 'bg-slate-300 text-slate-800' : 'bg-slate-200 text-slate-600'}`}>2</span>
                Plan
              </button>
              <ChevronRight size={14} className="text-slate-400" />
              <button 
                type="button"
                disabled={step < 2}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  step === 3 ? 'bg-red-600 text-white shadow-md shadow-red-600/20' : step >= 2 ? 'text-slate-600 hover:text-black' : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-white text-red-600' : step >= 2 ? 'bg-slate-300 text-slate-800' : 'bg-slate-200 text-slate-600'}`}>3</span>
                Payment
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 transition-all flex items-center gap-2 shadow-xs"
            >
              <ArrowLeft size={14} className="text-red-600" /> Back to Login
            </button>
          </div>
        </div>
      </header>

      {}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6  flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-xl mx-auto w-full animate-fade-in py-6"
            >
              <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-2xl">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-black text-black">Create your account</h1>
                  <p className="text-slate-600 mt-2">Start your 5L SOLUTIONS journey today</p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-3 font-bold">
                    <AlertCircle size={18} className="shrink-0 text-red-600" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="company_name">Company Name</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Building2 size={16} />
                      </span>
                      <input 
                        type="text" 
                        id="company_name" 
                        name="company_name"
                        value={formData.company_name}
                        onChange={handleChange}
                        required 
                        placeholder="Acme Corp" 
                        className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-black placeholder-slate-400 text-sm focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20 font-medium transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="email">Work Email</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail size={16} />
                      </span>
                      <input 
                        type="email" 
                        id="email" 
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required 
                        placeholder="name@company.com" 
                        className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-black placeholder-slate-400 text-sm focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20 font-medium transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="username">Username</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <User size={16} />
                      </span>
                      <input 
                        type="text" 
                        id="username" 
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        required 
                        placeholder="johndoe" 
                        className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-black placeholder-slate-400 text-sm focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20 font-medium transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5" htmlFor="password">Password</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock size={16} />
                      </span>
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        id="password" 
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required 
                        placeholder="••••••••" 
                        className="w-full pl-10 pr-10 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-black placeholder-slate-400 text-sm focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20 font-medium transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">Must be at least 8 characters long.</p>
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 px-4 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : <>Complete Registration <ArrowRight size={16} /></>}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs">
                    <button type="button" onClick={() => navigate('/login')} className="text-red-600 hover:text-red-700 font-bold">
                      Already have an account? Sign in
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          ) : step === 2 ? (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-10"
            >
              <div className="text-center max-w-3xl mx-auto space-y-4">
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-black">
                  Choose Your Plan
                </h1>
                <p className="text-lg text-slate-600">
                  Select the perfect operational workflow for your team. Switch billing options anytime.
                </p>

                <div className="pt-4 flex items-center justify-center gap-3">
                  <span className={`text-sm font-bold ${billingCycle === 'monthly' ? 'text-black' : 'text-slate-500'}`}>Monthly</span>
                  <button 
                    type="button" 
                    onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-slate-300 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-600"
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${billingCycle === 'annual' ? 'translate-x-5 bg-red-600' : 'translate-x-0'}`}></span>
                  </button>
                  <span className={`text-sm font-bold flex items-center gap-1.5 ${billingCycle === 'annual' ? 'text-black' : 'text-slate-500'}`}>
                    Annual <span className="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded-full font-black border border-red-200">Save 15%</span>
                  </span>
                </div>
              </div>

              {loadingPlans ? (
                <div className="py-24 text-center flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-red-600 mb-3" size={36} />
                  <p className="text-sm font-semibold text-slate-500">Loading plans...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
                  {filteredPlans.map((plan) => {
                    const isSelected = selectedPlan?.sp_id === plan.sp_id;
                    const price = calculatePrice(plan);

                    return (
                      <motion.div 
                        key={plan.sp_id}
                        whileHover={{ y: -4 }}
                        onClick={() => handlePlanSelect(plan)}
                        className={`rounded-3xl p-10 flex flex-col justify-between cursor-pointer transition-all duration-300 relative bg-white min-h-[520px] ${
                          isSelected 
                            ? 'border-2 border-red-600 shadow-xl shadow-red-600/10 ring-2 ring-red-600/20' 
                            : 'border border-slate-200 hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2">
                            <span className="bg-black text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md border border-slate-800 flex items-center gap-1">
                              <Star size={11} className="fill-red-500 text-red-500" /> {plan.badge || 'Most Popular'}
                            </span>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-black">{plan.sp_name}</h3>
                            <span className={`p-2.5 rounded-xl ${isSelected ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                              <Zap size={24} />
                            </span>
                          </div>
                          <p className="text-slate-500 text-base mt-3 leading-relaxed">{plan.sp_description}</p>
                          
                          <div className="mt-8 flex items-baseline">
                            <span className="text-5xl font-black text-black">₱{price.toLocaleString()}</span>
                            <span className="ml-2 text-base text-slate-500">/ {plan.billingCycle.toLowerCase()}</span>
                          </div>

                          <ul className="mt-10 space-y-5 text-base text-slate-700">
                            {(plan.features || []).map((feat, i) => (
                              <li key={i} className="flex items-center gap-3">
                                <div className="p-0.5 rounded-full bg-red-100 text-red-600 shrink-0 border border-red-200">
                                  <Check className="w-4 h-4" />
                                </div>
                                <span className="font-medium">{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-10">
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handlePlanSelect(plan); setStep(3); }}
                            className={`w-full py-4 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider ${
                              isSelected 
                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30' 
                                : 'bg-slate-100 hover:bg-black hover:text-white text-black'
                            }`}
                          >
                            Select {plan.sp_name.split(' ')[0]} <ArrowRight size={16} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              <div className="pt-8 flex justify-center">
                <button
                  type="button"
                  disabled={!selectedPlan}
                  onClick={() => selectedPlan && setStep(3)}
                  className="px-12 py-4 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-2xl shadow-xl shadow-red-600/30 transition-all flex items-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  Proceed with {selectedPlan?.sp_name || 'Selected Plan'} <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          ) : step === 3 ? (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-xl mx-auto w-full animate-fade-in py-6"
            >
              <button
                type="button"
                onClick={handleBackToPlans}
                className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-black transition-colors"
              >
                <ArrowLeft size={16} /> Back to Plans
              </button>

              <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-2xl">
                
                <div className="flex items-center justify-between pb-6 border-b border-slate-200 mb-6">
                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-wider text-red-600">Payment Summary</span>
                    <h2 className="text-2xl font-black text-black mt-0.5">{selectedPlan?.sp_name}</h2>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-black">₱{calculatePrice(selectedPlan).toLocaleString()}</span>
                    <span className="text-xs text-slate-500 block">per {selectedPlan?.billingCycle?.toLowerCase() || billingCycle}</span>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Plan</span>
                    <span className="font-bold text-black">{selectedPlan?.sp_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Billing Cycle</span>
                    <span className="font-bold text-black">{selectedPlan?.billingCycle?.toLowerCase()}</span>
                  </div>
                </div>

                {paymentError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-3 font-bold">
                    <AlertCircle size={18} className="shrink-0 text-red-600" />
                    <span>{paymentError}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button 
                    type="button"
                    onClick={handlePayment}
                    disabled={paymentLoading}
                    className="w-full py-4 px-4 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50"
                  >
                    {paymentLoading ? <Loader2 className="animate-spin" size={18} /> : <>Pay with PayMongo <ArrowRight size={16} /></>}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs">
                  <button type="button" onClick={() => setStep(2)} className="text-slate-600 hover:text-black font-bold flex items-center gap-1.5">
                    <ArrowLeft size={14} /> Back to Plans
                  </button>
                  <button type="button" onClick={() => navigate('/login')} className="text-red-600 hover:text-red-700 font-bold">
                    Already have an account? Sign in
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      
      {showToast && (
        <DynamicToast
          type={toastType}
          message={toastMessage}
          onClose={() => setShowToast(false)}
          duration={6000}
        />
      )}

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
                  <CheckCircle size={14} className={progress.progress >= 10 ? 'fill-current' : ''} />
                  <span>Validating information</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${progress.progress >= 15 ? 'text-green-600' : 'text-gray-400'}`}>
                  <CheckCircle size={14} className={progress.progress >= 15 ? 'fill-current' : ''} />
                  <span>Creating account</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${progress.progress >= 20 ? 'text-green-600' : 'text-gray-400'}`}>
                  <CheckCircle size={14} className={progress.progress >= 20 ? 'fill-current' : ''} />
                  <span>Creating database</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${progress.progress >= 60 ? 'text-green-600' : 'text-gray-400'}`}>
                  <CheckCircle size={14} className={progress.progress >= 60 ? 'fill-current' : ''} />
                  <span>Running migrations</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${progress.progress >= 85 ? 'text-green-600' : 'text-gray-400'}`}>
                  <CheckCircle size={14} className={progress.progress >= 85 ? 'fill-current' : ''} />
                  <span>Running seeders</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${progress.progress >= 90 ? 'text-green-600' : 'text-gray-400'}`}>
                  <CheckCircle size={14} className={progress.progress >= 90 ? 'fill-current' : ''} />
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