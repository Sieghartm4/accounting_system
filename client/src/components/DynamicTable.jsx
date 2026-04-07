import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Filter, Columns, Plus, X, Maximize2 } from 'lucide-react';

const DynamicTable = ({
  data,
  title = "Records",
  enableRowClick = false,
  returnColumn = null,
  onRowClick = null,
  enableAddButton = true,
  onAddClick = null
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [visibleColumns, setVisibleColumns] = useState(new Set());
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' });
  const dropdownRef = useRef(null);

  const handleRowClick = (row) => {
    if (enableRowClick && onRowClick && returnColumn && row[returnColumn] !== undefined) {
      onRowClick(row[returnColumn], row);
    }
  };

  const renderCellValue = (value) => {
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      return (
        <div className="relative group w-8 h-8">
          <img
            src={value}
            alt="Logo"
            className="h-8 w-8 object-cover rounded-lg border border-gray-200 cursor-pointer group-hover:ring-2 group-hover:ring-red-500 transition-all"
            onClick={() => setImageModal({ isOpen: true, imageSrc: value })}
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
            <Maximize2 size={12} className="text-white bg-black/50 rounded-full p-0.5" />
          </div>
        </div>
      );
    }
    return value !== null && value !== undefined ? String(value) : (
      <span className="text-gray-300 italic">-</span>
    );
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowColumnDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const headers = useMemo(() => (data && data.length > 0 ? Object.keys(data[0]) : []), [data]);

  useEffect(() => {
    if (headers.length > 0 && visibleColumns.size === 0) {
      setVisibleColumns(new Set(headers));
    }
  }, [headers]);

  const filteredAndSortedData = useMemo(() => {
    let filtered = data || [];
    if (searchTerm) {
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    if (filterColumn && filterValue) {
      filtered = filtered.filter(row =>
        String(row[filterColumn]).toLowerCase().includes(filterValue.toLowerCase())
      );
    }
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [data, searchTerm, filterColumn, filterValue, sortColumn, sortDirection]);

  const uniqueColumnValues = useMemo(() => {
    if (!filterColumn || !data) return [];
    const values = [...new Set(data.map(row => String(row[filterColumn])))];
    return values.sort();
  }, [data, filterColumn]);

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">

{/* --- INTEGRATED CONTROL BAR --- */}
      <div className="bg-black p-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">

          {/* LEFT SIDE: Title & Search */}
          <div className="flex items-center flex-1 gap-4">
            {/* Section 1: Title & Indicator */}
            <div className="flex items-center gap-3 pr-4 border-r border-gray-800">
              <div className="w-1.5 h-6 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
              <h2 className="text-xs font-black text-white uppercase tracking-[2px] whitespace-nowrap">
                {title}
              </h2>
            </div>

            {/* Section 2: Search - Now grows to fill left side */}
            <div className="flex-1 relative group max-w-md">
              <Search
                size={14}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-500 transition-colors z-10"
              />
              <input
                type="text"
                placeholder="Search database..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-600/40 focus:bg-white focus:border-red-500 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* RIGHT SIDE: Filters & Actions - Always at the end */}
          <div className="flex items-center gap-3">
            
            {/* Column Filter */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
              <Filter size={14} className="text-gray-600" />
              <select
                value={filterColumn}
                onChange={(e) => { setFilterColumn(e.target.value); setFilterValue(''); }}
                className="bg-transparent text-[10px] font-bold text-gray-700 uppercase tracking-widest outline-none cursor-pointer hover:text-black"
              >
                <option value="" className="bg-white text-gray-500">Filter By</option>
                {headers.map(h => <option key={h} value={h} className="bg-white text-black">{h.toUpperCase()}</option>)}
              </select>
            </div>

            {/* Value Filter (Conditional) */}
            {filterColumn && (
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 text-[10px] font-bold text-gray-700 rounded-lg outline-none uppercase animate-in fade-in zoom-in-95"
              >
                <option value="" className="bg-white">All Values</option>
                {uniqueColumnValues.map(v => <option key={v} value={v} className="bg-white">{v}</option>)}
              </select>
            )}

            {/* Visible Columns Toggle */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="p-2 bg-white border border-gray-300 text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-all"
                title="Visible Columns"
              >
                <Columns size={16} />
              </button>

              {showColumnDropdown && (
                <div className="absolute right-0 z-50 mt-3 w-56 bg-white border border-gray-300 rounded-xl shadow-2xl p-2 animate-in slide-in-from-top-2">
                  <div className="px-2 py-1.5 border-b border-gray-200 mb-1 flex justify-between items-center">
                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Columns</span>
                    <button onClick={() => setVisibleColumns(new Set(headers))} className="text-[9px] font-bold text-red-600">RESET</button>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {headers.map(header => (
                      <label key={header} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(header)}
                          onChange={() => {
                            const newCols = new Set(visibleColumns);
                            newCols.has(header) ? newCols.delete(header) : newCols.add(header);
                            setVisibleColumns(newCols);
                          }}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-[10px] font-bold text-gray-700 group-hover:text-black uppercase">{header}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Add Action Button */}
            {enableAddButton && (
              <button
                onClick={onAddClick}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-900/20 transition-all active:scale-95 border border-red-500/50"
              >
                <Plus size={16} />
                <span className="text-xs font-black uppercase tracking-widest">Add</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- DATA TABLE --- */}
      <div className="flex-1 overflow-auto bg-white custom-scrollbar">
        <style dangerouslySetInnerHTML={{
          __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #dc2626; /* red-600 */
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #b91c1c; /* red-700 */
                }
            `}} />
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
            <tr>
              {headers.map((header) => visibleColumns.has(header) && (
                <th
                  key={header}
                  onClick={() => {
                    setSortDirection(sortColumn === header && sortDirection === 'asc' ? 'desc' : 'asc');
                    setSortColumn(header);
                  }}
                  className="px-6 py-4 text-left group cursor-pointer hover:bg-gray-100/50 transition-all select-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black text-black uppercase tracking-[2px] transition-colors">
                      {header}
                    </span>
                    {sortColumn === header && (
                      <div className={`w-1 h-3 bg-red-600 rounded-full ${sortDirection === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAndSortedData.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => handleRowClick(row)}
                className={`group ${enableRowClick ? 'cursor-pointer' : ''} hover:bg-red-50/30 transition-colors`}
              >
                {headers.map((header) => visibleColumns.has(header) && (
                  <td key={header} className="px-6 py-4 text-xs font-bold text-gray-700 tracking-tight">
                    {renderCellValue(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

{/* --- REFINED DATA METRICS FOOTER --- */}
      <div className="bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Row Metrics */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[1.5px]">Total Rows:</span>
            <span className="text-[10px] font-black text-black">{data.length}</span>
            {filteredAndSortedData.length !== data.length && (
              <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                Showing {filteredAndSortedData.length}
              </span>
            )}
          </div>

          <div className="w-1 h-1 bg-gray-200 rounded-full" />

          {/* Column Metrics */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[1.5px]">Columns:</span>
            <span className="text-[10px] font-black text-black">{visibleColumns.size} <span className="text-gray-300 mx-1">/</span> {headers.length}</span>
          </div>

          <div className="w-1 h-1 bg-gray-200 rounded-full" />

          {/* System Status/Timestamp */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-[1.5px]">Last Sync:</span>
            <span className="text-[9px] font-bold text-gray-600 uppercase">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
        </div>

        {/* Right Side Details */}
        <div className="flex items-center gap-4">
           {searchTerm && (
             <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-100 rounded-md">
               <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
               <span className="text-[8px] font-black text-gray-500 uppercase tracking-tighter">Search Active</span>
             </div>
           )}
           <span className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">
             5L Solutions <span className="text-red-600">Corp.</span>
           </span>
        </div>
      </div>

      {/* --- IMAGE MODAL --- */}
      {imageModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
          <button
            onClick={() => setImageModal({ isOpen: false, imageSrc: '' })}
            className="absolute top-6 right-6 text-white hover:text-red-500 transition-colors"
          >
            <X size={32} />
          </button>
          <img
            src={imageModal.imageSrc}
            alt="Preview"
            className="max-w-full max-h-full rounded-2xl shadow-2xl border-4 border-white/10 p-2 scale-in animate-in zoom-in-95 duration-300"
          />
        </div>
      )}
    </div>
  );
};

export default DynamicTable;