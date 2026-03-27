import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User, ArrowRight, Loader2, ShieldCheck, PieChart, FileText } from 'lucide-react';
import useLogin from './useLogin';

export default function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const { login, loading, error } = useLogin();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    login(formData);
  };

  return (
    <div className="min-h-screen w-full flex bg-white font-sans">
      {/* --- Left Side: Corporate Branding Section --- */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="hidden lg:flex lg:w-7/12 relative overflow-hidden bg-black"
      >
        {/* Professional Architectural/Financial Overlay Image */}
        <img 
          src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80" 
          alt="Corporate Office" 
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        
        {/* Red Gradient Overlay for Depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-red-900/80 via-black/50 to-transparent"></div>

        <div className="relative z-10 m-auto max-w-xl p-12">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-5xl font-extrabold text-white leading-tight mb-6">
              5L Solutions <span className="text-red-600 block text-2xl mt-2 tracking-widest uppercase">Supply & Allied Services Corp.</span>
            </h1>
            <div className="h-1 w-24 bg-red-600 mb-8"></div>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4 text-white/90">
                <div className="p-2 bg-red-600/20 rounded-lg border border-red-600/30 text-red-500"><ShieldCheck size={24}/></div>
                <div>
                  <h3 className="font-bold text-lg">Secure Financial Ledger</h3>
                  <p className="text-sm text-gray-400">Enterprise-grade encryption for all corporate accounts.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 text-white/90">
                <div className="p-2 bg-red-600/20 rounded-lg border border-red-600/30 text-red-500"><PieChart size={24}/></div>
                <div>
                  <h3 className="font-bold text-lg">Real-time Analytics</h3>
                  <p className="text-sm text-gray-400">Instant visibility into supply chain and allied service margins.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Subtle Decorative Element */}
        <div className="absolute bottom-10 left-10 text-white/20 text-xs tracking-[0.5em] font-light">
          EST. 2026 | FINANCIAL SERVICES DIVISION
        </div>
      </motion.div>

      {/* --- Right Side: Secure Login Form --- */}
      <div className="w-full lg:w-5/12 flex items-center justify-center p-8 bg-white">
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm"
        >
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-black tracking-tight">Financial Portal</h2>
            <p className="text-gray-500 mt-2">Sign in to manage supply and allied services.</p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm flex items-center gap-3"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></div>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative group">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block group-focus-within:text-red-600 transition-colors">Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-600 transition-colors">
                  <User size={18} />
                </span>
                <input 
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3.5 border-b-2 border-gray-100 bg-gray-50/50 focus:bg-white focus:border-red-600 outline-none transition-all duration-300 rounded-t-lg" 
                  placeholder="Enter employee ID"
                  required
                />
              </div>
            </div>

            <div className="relative group">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2 block group-focus-within:text-red-600 transition-colors">Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-600 transition-colors">
                  <Lock size={18} />
                </span>
                <input 
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3.5 border-b-2 border-gray-100 bg-gray-50/50 focus:bg-white focus:border-red-600 outline-none transition-all duration-300 rounded-t-lg" 
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 accent-red-600 rounded border-gray-300" />
                <span className="text-sm text-gray-500 group-hover:text-black transition-colors">Remember device</span>
              </label>
              <a href="#" className="text-sm font-semibold text-red-600 hover:text-black transition-colors">Forgot Access?</a>
            </div>

            <motion.button 
              whileHover={{ backgroundColor: '#000000' }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white py-4 rounded-lg font-bold shadow-xl shadow-red-900/10 flex items-center justify-center gap-2 transition-all disabled:bg-gray-400 disabled:shadow-none uppercase tracking-widest text-sm"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : "Authorize Access"}
              {!loading && <ArrowRight size={18} />}
            </motion.button>
          </form>

          <div className="mt-12 pt-8 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-400">
              Authorized Personnel Only. <br />
              <span className="font-semibold text-black">© 2026 5L Solutions Corp.</span>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}