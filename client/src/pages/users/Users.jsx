import React from 'react';
import { motion } from 'framer-motion';
import { UserCheck, UserPlus, Shield, ArrowRight, UserCog, Activity, Mail } from 'lucide-react';
import DynamicTable from '../../components/DynamicTable';
import RouteProtection from '../../components/RouteProtection';
import ProtectedAction from '../../components/ProtectedAction';
import useUsers from './useUsers';

export default function Users() {
  return (
    <RouteProtection routeName="users">
      <UsersContent />
    </RouteProtection>
  );
}

function UsersContent() {
  const { users, loading, error, handleUserRowClick } = useUsers();

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">Loading User Base...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl shadow-sm">
          <h3 className="text-red-800 font-bold uppercase text-sm">System Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      
      {/* --- TOP NAVIGATION BREADCRUMB --- */}
      {/* <nav className="flex-shrink-0 flex items-center gap-2 mb-6 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        <span className="hover:text-red-600 cursor-pointer transition-colors">Internal Systems</span>
        <ArrowRight size={10} />
        <span className="text-black font-black">User Accounts</span>
      </nav> */}

      {/* --- PAGE HEADER & ACTIONS --- */}
      <div className="flex-shrink-0">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4"
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-black rounded-xl text-red-500 shadow-xl shadow-black/20">
                <UserCog size={26} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Personnel <span className="text-red-600 italic">Accounts</span>
              </h1>
            </div>
            {/* <p className="text-gray-500 text-sm font-medium italic">
              Authenticated system operators and administrative staff.
            </p> */}
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Mail size={16} className="text-red-600" />
              SEND INVITE
            </button>
            <ProtectedAction routeName="users">
              <button className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-xl tracking-widest uppercase">
                <UserPlus size={16} />
                Register User
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- USER STATISTICS TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <AccountCard 
            icon={<UserCheck className="text-red-600" size={20} />} 
            label="Total Personnel" 
            value={users?.length || 0} 
            subText="Active Profiles"
          />
          <AccountCard 
            icon={<Shield className="text-black" size={20} />} 
            label="Super Admins" 
            value="2" 
            subText="Elevated Access"
          />
          <AccountCard 
            icon={<Activity className="text-green-600" size={20} />} 
            label="Online Now" 
            value="Active" 
            subText="Live Sync"
          />
        </div>
      </div>

      {/* --- TABLE SECTION (The "Fixed" Container) --- */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="flex-1 min-h-0 bg-white rounded-2xl shadow-2xl shadow-gray-200/50 overflow-hidden border border-gray-100"
      >
        <DynamicTable 
          data={users} 
          title="Users table"
          enableAddButton={false}
          enableRowClick={false}
          returnColumn="username"
          onRowClick={handleUserRowClick}
        />
      </motion.div>
    </div>
  );
}

function AccountCard({ icon, label, value, subText }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 shadow-sm hover:border-red-100 transition-colors group">
      <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-red-50/50 transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 leading-none">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-xl font-black text-black leading-none">{value}</h4>
          <span className="text-[9px] font-bold text-gray-400 uppercase">{subText}</span>
        </div>
      </div>
    </div>
  );
}