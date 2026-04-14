import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Filter, Columns, Plus, X, Maximize2 } from 'lucide-react';

const DynamicTable = ({
  data,
  title = "Records",
  enableRowClick = false,
  returnColumn = null,
  onRowClick = null,
  enableAddButton = true,
  onAddClick = null,
  optionColumns = new Set(),
  onOptionChange = null,
  // --- OPTION SELECT PROPS ---
  selectOptions = [],         // array of { value, label } for select dropdowns
  // --- CHECKBOX PROPS ---
  enableCheckbox = false,
  checkboxColumn = null,        // which column value to use as unique key (e.g. 'id', 'name')
  checkboxActions = [],         // array of { label, onClick(selectedRows) } buttons shown when rows are selected
  // --- CONDITIONAL CHECKBOX PROPS ---
  checkboxCondition = null,      // { column: 'status', value: 'prepared' } - only show checkboxes for rows with this column value
  checkboxConditionAll = false,   // if true, show checkboxes for all rows (overrides checkboxCondition)
  // --- ACTION COLUMN PROPS ---
  enableActionColumn = false,     // if true, shows an action column with buttons
  actionButtons = [],            // array of { label, onClick(row), icon } buttons for each row
  // --- BADGE PROPS ---
  badgeColumns = [],             // array of { column: 'status', values: { 'PAID': 'green', 'UNPAID': 'red' } } for dynamic badges
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [visibleColumns, setVisibleColumns] = useState(new Set());
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' });
  // --- CHECKBOX STATE: a Set of unique keys (values from checkboxColumn) ---
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  // --- OPTION COLUMNS STATE: track changes to dropdown values ---
  const [optionData, setOptionData] = useState(new Map());
  const dropdownRef = useRef(null);

  // --- CHECKBOX HELPERS ---
  // Derive the unique key for a row. Falls back to index if checkboxColumn not set.
  const getRowKey = (row, idx) => {
    if (checkboxColumn && row[checkboxColumn] !== undefined) {
      return String(row[checkboxColumn]);
    }
    return String(idx);
  };

  // Check if row should have checkbox based on condition
  const shouldShowCheckbox = (row) => {
    if (!enableCheckbox) return false;
    if (checkboxConditionAll) return true;
    if (checkboxCondition && checkboxCondition.column && checkboxCondition.value) {
      return String(row[checkboxCondition.column]).toLowerCase() === String(checkboxCondition.value).toLowerCase();
    }
    return true; // Default to true if no condition
  };

  const handleRowClick = (row) => {
    if (enableRowClick && onRowClick && returnColumn && row[returnColumn] !== undefined) {
      onRowClick(row[returnColumn], row);
    }
  };

  // Function to convert underscores to spaces for display
  const formatHeader = (header) => {
    return header.replace(/_/g, ' ');
  };

  const renderCellValue = (value, header, row) => {
    // Check if this column should render a badge
    const badgeColumn = badgeColumns.find(badge => badge.column === header);
    if (badgeColumn && badgeColumn.values && value) {
      const badgeColor = badgeColumn.values[String(value).toUpperCase()] || 'gray';
      const colorClasses = {
        green: 'bg-green-100 text-green-800 border-green-200',
        red: 'bg-red-100 text-red-800 border-red-200',
        yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        blue: 'bg-blue-100 text-blue-800 border-blue-200',
        purple: 'bg-purple-100 text-purple-800 border-purple-200',
        gray: 'bg-gray-100 text-gray-800 border-gray-200',
        orange: 'bg-orange-100 text-orange-800 border-orange-200'
      };
      
      return (
        <span className={`inline-flex items-center justify-center text-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${colorClasses[badgeColor] || colorClasses.gray}`}>
          {String(value)}
        </span>
      );
    }

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

    if (optionColumns.has(header) && row) {
      // Get the row key for tracking option changes
      const rowKey = getRowKey(row, filteredAndSortedData.indexOf(row));
      const optionKey = `${rowKey}-${header}`;
      const currentValue = optionData.get(optionKey) || value || '';
      
      return (
        <select
          value={currentValue}
          onChange={(e) => {
            setOptionData(prev => new Map(prev).set(optionKey, e.target.value));
            
            if (onOptionChange) {
              const rowId = row[checkboxColumn] || row[returnColumn] || row.id;
              onOptionChange(rowId, e.target.value, row);
            }
            
            if (onRowClick && returnColumn) {
              const updatedRow = { ...row, [header]: e.target.value };
              onRowClick(updatedRow[returnColumn], updatedRow);
            }
          }}
          className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-bold focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          {selectOptions.map((option, idx) => (
            <option key={idx} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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

  // Clear selections and option data when data changes
  useEffect(() => {
    setSelectedKeys(new Set());
    setOptionData(new Map());
  }, [data]);

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

  const allVisibleKeys = filteredAndSortedData
    .map((row, idx) => shouldShowCheckbox(row) ? getRowKey(row, idx) : null)
    .filter(key => key !== null);
  const allChecked = allVisibleKeys.length > 0 && allVisibleKeys.every(k => selectedKeys.has(k));
  const someChecked = allVisibleKeys.some(k => selectedKeys.has(k));

  const handleHeaderCheckbox = () => {
    if (allChecked) {
      // Uncheck all visible rows
      setSelectedKeys(prev => {
        const next = new Set(prev);
        allVisibleKeys.forEach(k => next.delete(k));
        return next;
      });
    } else {
      // Check all visible rows
      setSelectedKeys(prev => {
        const next = new Set(prev);
        allVisibleKeys.forEach(k => next.add(k));
        return next;
      });
    }
  };

  const handleRowCheckbox = (key, e) => {
    // Stop propagation so it doesn't also trigger handleRowClick
    e.stopPropagation();
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Build the array of selected full row objects for action callbacks
  const selectedRows = useMemo(() => {
    return filteredAndSortedData.filter((row, idx) => selectedKeys.has(getRowKey(row, idx)));
  }, [filteredAndSortedData, selectedKeys]);

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

            {/* Section 2: Search */}
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

          {/* RIGHT SIDE: Filters & Actions */}
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

      {/* --- CHECKBOX ACTION BAR (shown when rows are selected) --- */}
      {enableCheckbox && selectedKeys.size > 0 && checkboxActions.length > 0 && (
        <div className="flex-shrink-0 bg-red-50 border-b border-red-100 px-6 py-2 flex items-center gap-3 animate-in slide-in-from-top-1">
          <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">
            {selectedKeys.size} Selected
          </span>
          <div className="w-px h-4 bg-red-200" />
          {checkboxActions.map((action, i) => (
            action.type === 'dropdown' ? (
              <div key={i} className="flex items-center gap-1.5">
                {action.icon && <span className="w-3 h-3">{action.icon}</span>}
                <select
                  onChange={(e) => {
                    if (e.target.value && action.onChange) {
                      action.onChange(selectedRows, e.target.value);
                      // Reset dropdown to default state after selection
                      e.target.value = '';
                    }
                  }}
                  className="px-3 py-1.5 bg-white border border-red-200 text-red-700 text-[10px] font-black rounded-lg hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-500 uppercase tracking-widest cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>{action.label}</option>
                  {action.options.map((option, idx) => (
                    <option key={idx} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <button
                key={i}
                onClick={() => action.onClick(selectedRows)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 border border-green-600 text-white text-[10px] font-black rounded-lg hover:bg-green-200 hover:text-green-700 hover:border-green-300 hover:cursor-pointer transition-all uppercase tracking-widest"
              >
                {action.icon && <span className="w-3 h-3">{action.icon}</span>}
                {action.label}
              </button>
            )
          ))}
          <button
            onClick={() => setSelectedKeys(new Set())}
            className="ml-auto text-[9px] font-black text-gray-400 hover:text-red-600 uppercase tracking-widest transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* --- DATA TABLE --- */}
      <div className="flex-1 overflow-auto bg-white custom-scrollbar">
        <style dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 5px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #dc2626; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #b91c1c; }
            .row-checkbox { width: 15px; height: 15px; accent-color: #dc2626; cursor: pointer; }
          `}} />
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
            <tr>
              {/* CHECKBOX HEADER COLUMN */}
              {enableCheckbox && (
                <th className="px-4 py-4 w-10">
                  {allVisibleKeys.length > 0 && (
                    <input
                      type="checkbox"
                      className="row-checkbox"
                      checked={allChecked}
                      ref={el => {
                        if (el) el.indeterminate = someChecked && !allChecked;
                      }}
                      onChange={handleHeaderCheckbox}
                      title={allChecked ? 'Uncheck all' : 'Check all'}
                    />
                  )}
                </th>
              )}
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
                      {formatHeader(header)}
                    </span>
                    {sortColumn === header && (
                      <div className={`w-1 h-3 bg-red-600 rounded-full ${sortDirection === 'desc' ? 'rotate-180' : ''} transition-transform`} />
                    )}
                  </div>
                </th>
              ))}
              {/* ACTION COLUMN HEADER */}
              {enableActionColumn && (
                <th className="px-6 py-4 text-center">
                  <span className="text-[12px] font-black text-black uppercase tracking-[2px]">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAndSortedData.map((row, idx) => {
              const rowKey = getRowKey(row, idx);
              const isChecked = selectedKeys.has(rowKey);
              return (
                <tr
                  key={idx}
                  onClick={() => handleRowClick(row)}
                  className={`group ${enableRowClick ? 'cursor-pointer' : ''} ${isChecked ? 'bg-red-50/60' : 'hover:bg-red-50/30'} transition-colors`}
                >
                  {/* CHECKBOX ROW CELL */}
                  {enableCheckbox && (
                    <td className="px-4 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                      {shouldShowCheckbox(row) && (
                        <input
                          type="checkbox"
                          className="row-checkbox"
                          checked={isChecked}
                          onChange={(e) => handleRowCheckbox(rowKey, e)}
                        />
                      )}
                    </td>
                  )}
                  {headers.map((header) => visibleColumns.has(header) && (
                    <td key={header} className="px-6 py-4 text-xs font-bold text-gray-700 tracking-tight">
                      {renderCellValue(row[header], header, row)}
                    </td>
                  ))}
                  {/* ACTION COLUMN CELL */}
                  {enableActionColumn && (
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {actionButtons.map((button, buttonIdx) => (
                          <button
                            key={buttonIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              button.onClick(row);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition-all uppercase tracking-widest border border-blue-500/50 cursor-pointer"
                            title={button.label}
                          >
                            {button.icon && <span className="w-3 h-3">{button.icon}</span>}
                            {button.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
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

          {/* Selected count in footer */}
          {enableCheckbox && selectedKeys.size > 0 && (
            <>
              <div className="w-1 h-1 bg-gray-200 rounded-full" />
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[1.5px]">Selected:</span>
                <span className="text-[10px] font-black text-red-600">{selectedKeys.size}</span>
              </div>
            </>
          )}
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