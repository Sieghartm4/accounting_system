import React from 'react'
import { motion } from 'framer-motion'
import {
  Building2,
  Phone,
  Save,
  CheckCircle,
  Image,
  Globe,
  Mail,
  Hash,
  MapPin,
} from 'lucide-react'
import RouteProtection from '../../components/RouteProtection'
import ProtectedAction from '../../components/ProtectedAction'
import useCompany from './useCompany'

function CompanyContent() {
  const {
    company,
    loading,
    error,
    logoPreview,
    status,
    formData,
    handleLogoChange,
    handleInputChange,
    handleSubmit,
  } = useCompany()

  const fadeInUp = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  }

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-[#f4f5f7]">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">
          Synchronizing Company Data...
        </p>
      </div>
    )
  }

  return (
    <div className=" h-full flex flex-col gap-6 overflow-hidden bg-[#f4f5f7]">
      <ProtectedAction
        routeName="company"
        fallback={
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <Building2 size={48} className="text-gray-300" />
            <h3 className="text-lg font-bold text-gray-500">Access Restricted</h3>
            <p className="text-sm text-gray-400">
              Please contact systems admin for Company Profile access.
            </p>
          </div>
        }
      >
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="flex flex-col gap-4 h-full overflow-hidden"
        >
          {/* ── Page Header (Matches Image Style) ────────────────── */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm">
                <Building2 size={24} className="text-red-600" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 leading-none tracking-tight">
                  Company <span className="text-red-600 italic">Information</span>
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    System Configuration & Branding
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2.5 bg-black hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all duration-200 shadow-lg hover:shadow-red-900/20 uppercase tracking-widest"
              >
                <Save size={14} />
                Save Changes
              </button>
            </div>
          </div>

          {/* ── Summary Cards ────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-6 flex-shrink-0">
            <SummaryCard
              label="Entity Name"
              value={formData.company_name || 'NOT SET'}
              icon={<Building2 size={20} className="text-red-600" />}
              sub="Primary Legal Title"
            />
            <SummaryCard
              label="Contact Status"
              value={formData.phone || 'NO PHONE'}
              icon={<Phone size={20} className="text-blue-600" />}
              sub="Verified Representative"
            />
            <SummaryCard
              label="Profile Status"
              value={status === 'active' ? 'Active' : 'Inactive'}
              icon={
                <CheckCircle
                  size={20}
                  className={
                    status === 'active' ? 'text-green-600' : 'text-gray-400'
                  }
                />
              }
              sub="Audit Verified Ready"
            />
          </div>

          {/* ── Main Form Container ────────────────────────────────── */}
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-xl flex flex-col overflow-hidden">
            {/* Dark Section Header (Matches Master Ledger Bar) */}
            <div className="bg-black h-12 flex items-center justify-between px-6 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-[4px] h-6 bg-red-600 rounded-full" />
                <span className="text-white text-sm font-bold uppercase tracking-[2px]">
                  Organization Profile
                </span>
              </div>
              <div className="text-gray-500 text-[10px] font-mono tracking-widest uppercase">
                ID: {formData.tin || 'PENDING'}
              </div>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="w-full grid grid-cols-12 gap-x-8 gap-y-10">
                {/* LEFT COLUMN: Identity & Registration */}
                <div className="col-span-4 flex flex-col gap-6">
                  <SectionHeader label="Identity & Registration" />

                  <Field label="Company Name">
                    <div className="relative">
                      <Building2
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={16}
                      />
                      <input
                        type="text"
                        value={formData.company_name}
                        onChange={(e) =>
                          handleInputChange('company_name', e.target.value)
                        }
                        placeholder="e.g. 5L Solutions Corp."
                        className={inputCls}
                      />
                    </div>
                  </Field>

                  <Field label="Authorized Owner">
                    <input
                      type="text"
                      value={formData.owner_name}
                      onChange={(e) =>
                        handleInputChange('owner_name', e.target.value)
                      }
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Tax Identification Number (TIN)">
                    <div className="relative">
                      <Hash
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={16}
                      />
                      <input
                        type="text"
                        value={formData.tin}
                        onChange={(e) => handleInputChange('tin', e.target.value)}
                        inputMode="numeric"
                        maxLength={19}
                        placeholder="000-000-000-000-000"
                        className={inputCls}
                      />
                    </div>
                  </Field>
                </div>

                {/* CENTER COLUMN: Communication & Address */}
                <div className="col-span-4 flex flex-col gap-6">
                  <SectionHeader label="Communication" />

                  <Field label="Business Email">
                    <div className="relative">
                      <Mail
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={16}
                      />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </Field>

                  <div className="grid grid-cols-1 gap-6">
                    <Field label="Business Phone">
                      <div className="relative">
                        <Phone
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          size={16}
                        />
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) =>
                            handleInputChange('phone', e.target.value)
                          }
                          className={inputCls}
                        />
                      </div>
                    </Field>

                    <Field label="Official Website">
                      <div className="relative">
                        <Globe
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                          size={16}
                        />
                        <input
                          type="text"
                          value={formData.website}
                          onChange={(e) =>
                            handleInputChange('website', e.target.value)
                          }
                          placeholder="https://www.mywebsite.com"
                          className={inputCls}
                        />
                      </div>
                    </Field>
                  </div>

                  <SectionHeader label="Physical Headquarters" />
                  <Field label="Complete Business Address">
                    <div className="relative">
                      <MapPin
                        className="absolute left-3 top-4 text-gray-400"
                        size={16}
                      />
                      <textarea
                        value={formData.address}
                        onChange={(e) =>
                          handleInputChange('address', e.target.value)
                        }
                        rows={3}
                        className={inputCls + ' pl-10 pt-3 resize-none'}
                        placeholder="Bldg Number, Street, City, Province, Zip Code"
                      />
                    </div>
                  </Field>
                </div>

                {/* RIGHT COLUMN: Visual Branding & Status */}
                <div className="col-span-4 flex flex-col gap-6">
                  <SectionHeader label="Visual Branding" />

                  <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center gap-4">
                    <div className="w-full aspect-video bg-white rounded-xl border border-gray-100 shadow-inner flex items-center justify-center overflow-hidden relative group">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Company Logo"
                          className="w-full h-full object-contain p-4"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-300">
                          <Image size={48} strokeWidth={1} />
                          <span className="text-[10px] uppercase font-bold tracking-widest">
                            No Logo Uploaded
                          </span>
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleLogoChange}
                        />
                        <span className="text-white text-xs font-bold uppercase tracking-tighter">
                          Replace Logo
                        </span>
                      </label>
                    </div>
                    <p className="text-[10px] text-gray-400 text-center leading-relaxed px-4">
                      PNG or SVG with transparent background (Max 2MB).
                    </p>
                  </div>

                  <SectionHeader label="Account Status" />
                  <div className="grid grid-cols-2 gap-2">
                    {['active', 'inactive'].map((val) => (
                      <button
                        key={val}
                        onClick={() => handleInputChange('status', val)}
                        className={`py-3 rounded-xl border-2 font-bold text-[10px] uppercase tracking-widest transition-all
              ${
                status === val
                  ? val === 'active'
                    ? 'bg-green-50 border-green-500 text-green-700 shadow-md shadow-green-100'
                    : 'bg-gray-100 border-gray-500 text-gray-700'
                  : 'bg-white border-gray-100 text-gray-300 hover:border-gray-200'
              }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Status Bar */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  Last Sync:{' '}
                  <span className="text-gray-900 font-black">10:01 AM</span>
                </p>
                <div className="h-3 w-px bg-gray-300" />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  Version:{' '}
                  <span className="text-gray-900 font-black">
                    V2.0.4 ALLIED SERVICES
                  </span>
                </p>
              </div>
              <p className="text-[11px] font-black text-red-600 tracking-[2px] uppercase">
                5L Solutions Corp.
              </p>
            </div>
          </div>
        </motion.div>
      </ProtectedAction>
    </div>
  )
}

// ── Refined Helpers ──────────────────────────────────────────────────────

const inputCls =
  'w-full pl-10 pr-4 py-3 text-sm border-2 border-gray-100 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-red-600 focus:bg-white focus:ring-4 focus:ring-red-50 transition-all font-medium'

function SummaryCard({ label, value, icon, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-[#f8f9fa] border border-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
          {label}
        </p>
        <p className="text-lg font-black text-gray-900 truncate tracking-tight">
          {value}
        </p>
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
          {sub}
        </p>
      </div>
    </div>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[1.5px] mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}

function SectionHeader({ label }) {
  return (
    <div className="col-span-full flex items-center gap-4 mt-2">
      <span className="text-[11px] font-black text-gray-900 uppercase tracking-[3px]">
        {label}
      </span>
      <div className="flex-1 h-[2px] bg-gray-100 rounded-full" />
    </div>
  )
}

export default function Company() {
  return (
    <RouteProtection routeName="company">
      <CompanyContent />
    </RouteProtection>
  )
}
