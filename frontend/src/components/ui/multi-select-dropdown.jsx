import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

const MultiSelectDropdown = ({ 
  options = [], 
  selectedValues = [], 
  onChange, 
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  className = "",
  maxHeight = "200px",
  showSearch = true,
  groupBy = null,
  renderOption = null,
  renderSelectedItem = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter options based on search term
  const filteredOptions = options.filter(option => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      option.label?.toLowerCase().includes(searchLower) ||
      option.value?.toLowerCase().includes(searchLower) ||
      option.type?.toLowerCase().includes(searchLower)
    );
  });

  // Group options if groupBy is specified
  const groupedOptions = groupBy 
    ? filteredOptions.reduce((groups, option) => {
        const key = option[groupBy] || 'Other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(option);
        return groups;
      }, {})
    : { 'All': filteredOptions };

  const handleToggleOption = (option) => {
    const isSelected = selectedValues.includes(option.value);
    let newSelection;
    
    if (isSelected) {
      newSelection = selectedValues.filter(val => val !== option.value);
    } else {
      newSelection = [...selectedValues, option.value];
    }
    
    onChange(newSelection);
  };

  const handleRemoveItem = (value) => {
    const newSelection = selectedValues.filter(val => val !== value);
    onChange(newSelection);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const getSelectedOptions = () => {
    return options.filter(option => selectedValues.includes(option.value));
  };

  const defaultRenderOption = (option, isSelected) => (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium text-sm">{option.label}</div>
        {option.type && (
          <div className="text-xs text-muted-foreground">{option.type}</div>
        )}
      </div>
      {isSelected && (
        <div className="text-blue-600 font-medium">✓</div>
      )}
    </div>
  );

  const defaultRenderSelectedItem = (option) => (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      option.type === 'KE' 
        ? 'bg-blue-100 text-blue-800 border border-blue-200' 
        : option.type === 'MIE'
        ? 'bg-green-100 text-green-800 border border-green-200'
        : 'bg-gray-100 text-gray-800 border border-gray-200'
    }`}>
      {option.label}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleRemoveItem(option.value);
        }}
        className="ml-1 text-gray-400 hover:text-gray-600"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 border border-border rounded-md bg-background cursor-pointer flex items-center justify-between hover:border-primary/50 transition-colors"
      >
        <div className="flex-1">
          {selectedValues.length === 0 ? (
            <span className="text-muted-foreground text-sm">{placeholder}</span>
          ) : (
            <span className="text-sm font-medium">
              {selectedValues.length} item{selectedValues.length !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Selected Items Display */}
      {selectedValues.length > 0 && (
        <div className="mt-2 p-2 bg-muted/50 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Selected ({selectedValues.length}):
            </span>
            <button
              onClick={handleClearAll}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Clear All
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {getSelectedOptions().map(option => (
              <div key={option.value}>
                {renderSelectedItem ? renderSelectedItem(option) : defaultRenderSelectedItem(option)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg">
          {/* Search Input */}
          {showSearch && (
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {Object.keys(groupedOptions).length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">
                No options available
              </div>
            ) : (
              Object.entries(groupedOptions).map(([groupName, groupOptions]) => (
                <div key={groupName}>
                  {groupBy && Object.keys(groupedOptions).length > 1 && (
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/30 border-b border-border">
                      {groupName} ({groupOptions.length})
                    </div>
                  )}
                  {groupOptions.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      No items found matching "{searchTerm}"
                    </div>
                  ) : (
                    groupOptions.map(option => {
                      const isSelected = selectedValues.includes(option.value);
                      return (
                        <div
                          key={option.value}
                          onClick={() => handleToggleOption(option)}
                          className={`p-3 cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-b-0 ${
                            isSelected ? 'bg-primary/10' : ''
                          }`}
                        >
                          {renderOption ? renderOption(option, isSelected) : defaultRenderOption(option, isSelected)}
                        </div>
                      );
                    })
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {filteredOptions.length > 0 && (
            <div className="p-2 border-t border-border bg-muted/30">
              <div className="text-xs text-muted-foreground text-center">
                {selectedValues.length} of {options.length} items selected
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
