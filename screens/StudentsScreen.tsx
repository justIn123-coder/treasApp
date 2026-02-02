
import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Student, Collection, RemittedCollection, CustomField, Payment } from '../types';
import { useStudents } from '../contexts/StudentsContext';
import { useCollections } from '../contexts/CollectionsContext';
import { useRemittedCollections } from '../contexts/RemittedCollectionsContext';
import ImportStudentsModal from '../components/ImportStudentsModal';
import AddStudentModal from '../components/AddStudentModal';
import { useProfile } from '../contexts/ProfileContext';

declare var XLSX: any;

// Helper to calculate target amount for a specific student in a specific collection
const getStudentTargetAmount = (collection: Collection | RemittedCollection, payment?: Payment): number => {
    let customFieldAmount = 0;
    let hasCustomAmountFieldWithValue = false;

    const processFields = (fields: CustomField[]) => {
        fields.forEach(field => {
            if (payment?.customFieldValues && (field.type === 'option' || field.type === 'checkbox')) {
                const selectedValues = payment.customFieldValues[field.id]?.split(', ').filter(Boolean) || [];
                if (selectedValues.length > 0) {
                    field.options?.forEach(option => {
                        if (selectedValues.includes(option.value) && typeof option.amount === 'number') {
                            hasCustomAmountFieldWithValue = true;
                            customFieldAmount += option.amount;
                        }
                        if (selectedValues.includes(option.value) && field.subFields?.[option.id]) {
                            processFields(field.subFields[option.id]);
                        }
                    });
                }
            }
        });
    };

    if (collection.customFields) {
        processFields(collection.customFields);
    }
    
    if (hasCustomAmountFieldWithValue) {
        return customFieldAmount;
    }
    
    return collection.targetAmount || 0;
};

interface StudentsScreenProps {
  onSelectStudentPayment: (collectionId: string, studentId: string) => void;
  onSelectCollection: (collection: Collection | RemittedCollection) => void;
}

type FilterType = 'all' | 'credit' | 'debit';

const StudentsScreen: React.FC<StudentsScreenProps> = ({ onSelectStudentPayment, onSelectCollection }) => {
  const { students, setStudents } = useStudents();
  const { collections } = useCollections();
  const { remittedCollections } = useRemittedCollections();
  const { profile } = useProfile();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Persisted Full Screen State
  const [isFullScreen, setIsFullScreen] = useState(() => {
    const saved = localStorage.getItem('students_is_fullscreen');
    return saved === 'true';
  });

  const [isFrozen, setIsFrozen] = useState(() => {
    const saved = localStorage.getItem('students_is_frozen');
    return saved === 'true';
  });
  const [frozenWidth, setFrozenWidth] = useState(() => {
    const saved = localStorage.getItem('students_frozen_width');
    return saved ? parseInt(saved, 10) : 200;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [zoomScale, setZoomScale] = useState(() => {
    const saved = localStorage.getItem('students_zoom_scale');
    return saved ? parseFloat(saved) : 1.0;
  });

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const headerLongPressTimer = useRef<number | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);
  const lastClickTimeRef = useRef<{ [key: string]: number }>({});
  
  // Pinch Gesture Refs
  const lastPinchDistance = useRef<number | null>(null);

  const sortedAllCollections = [...collections, ...remittedCollections].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Persist Layout Settings
  useEffect(() => {
    localStorage.setItem('frozenWidth', frozenWidth.toString());
  }, [frozenWidth]);

  useEffect(() => {
    localStorage.setItem('students_is_frozen', isFrozen.toString());
  }, [isFrozen]);

  useEffect(() => {
    localStorage.setItem('students_zoom_scale', zoomScale.toString());
  }, [zoomScale]);

  useEffect(() => {
    localStorage.setItem('students_is_fullscreen', isFullScreen.toString());
  }, [isFullScreen]);

  // Handle Pinch to Zoom - Optical Zoom Approach
  const handleTouchMoveInternal = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      if (e.cancelable) e.preventDefault();
      
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      if (lastPinchDistance.current !== null) {
        const delta = distance - lastPinchDistance.current;
        const zoomStep = delta * 0.005;
        setZoomScale(prev => Math.max(0.6, Math.min(2.0, prev + zoomStep)));
      }
      lastPinchDistance.current = distance;
    } else {
        lastPinchDistance.current = null;
    }
  }, []);

  const handleTouchEndInternal = useCallback((e: TouchEvent) => {
    if (e.touches.length < 2) {
      lastPinchDistance.current = null;
    }
  }, []);

  useEffect(() => {
    const table = tableContainerRef.current;
    if (!table) return;
    table.addEventListener('touchmove', handleTouchMoveInternal, { passive: false });
    table.addEventListener('touchend', handleTouchEndInternal);
    return () => {
      table.removeEventListener('touchmove', handleTouchMoveInternal);
      table.removeEventListener('touchend', handleTouchEndInternal);
    };
  }, [handleTouchMoveInternal, handleTouchEndInternal]);

  // Persist and Restore Scroll Position
  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    if (!tableContainer) return;

    const savedX = localStorage.getItem('students_scroll_x');
    const savedY = localStorage.getItem('students_scroll_y');
    
    if (savedX || savedY) {
      const timer = setTimeout(() => {
        if (savedX) tableContainer.scrollLeft = parseInt(savedX, 10);
        if (savedY) tableContainer.scrollTop = parseInt(savedY, 10);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [students.length, filterType, searchTerm]);

  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    if (!tableContainer) return;

    const handleScroll = () => {
      isScrollingRef.current = true;
      localStorage.setItem('students_scroll_x', tableContainer.scrollLeft.toString());
      localStorage.setItem('students_scroll_y', tableContainer.scrollTop.toString());

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = window.setTimeout(() => { 
        isScrollingRef.current = false; 
      }, 150);
    };

    tableContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      tableContainer.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleAddStudent = (studentName: string, studentNo: string, notes?: string) => {
    const newStudent: Student = { id: `${Date.now()}`, studentName, studentNo, notes: notes || undefined };
    setStudents((prev: Student[]) => [...prev, newStudent].sort((a: Student, b: Student) => a.studentName.localeCompare(b.studentName)));
    setIsAddModalOpen(false);
  };

  const handleImportStudents = (importedStudents: Student[]) => {
    setStudents((prev: Student[]) => {
      const studentMap = new Map(prev.map(s => [s.studentNo, s]));
      importedStudents.forEach(imported => studentMap.set(imported.studentNo, imported));
      return Array.from(studentMap.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
    });
    setIsImportModalOpen(false);
  };

  const handleExport = () => {
    const treasurerName = profile.name;
    const studentId = profile.studentId;
    const collectionsForExport = [...collections, ...remittedCollections].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const headerRow = ['Student No', 'Student Name', ...collectionsForExport.map(c => c.name)];
    const studentDataRows = students.map(student => {
      const row: (string | number)[] = [student.studentNo, student.studentName];
      collectionsForExport.forEach(collection => {
        const isStudentIncluded = !collection.includedStudentIds || collection.includedStudentIds.includes(student.id);
        if (isStudentIncluded) {
          const payment = collection.payments.find(p => p.studentId === student.id);
          row.push(payment ? payment.amount : 0);
        } else {
          row.push('N/A');
        }
      });
      return row;
    });
    const footerData = [[], ["Treasurer's Name:", treasurerName], ["Student ID:", studentId]];
    const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...studentDataRows, ...footerData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Payments');
    try {
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Student_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) { alert("Could not export the file."); }
  };

  const filteredStudents = useMemo(() => {
    let result = students;
    if (searchTerm) {
      result = result.filter(s => s.studentName.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (filterType !== 'all') {
      result = result.filter(student => {
        return sortedAllCollections.some(collection => {
          const isStudentIncluded = !collection.includedStudentIds || collection.includedStudentIds.includes(student.id);
          if (!isStudentIncluded) return false;
          const payment = collection.payments.find(p => p.studentId === student.id);
          const amount = payment?.amount || 0;
          const target = getStudentTargetAmount(collection, payment);
          
          if (filterType === 'credit') return amount > target && target > 0;
          if (filterType === 'debit') return amount > 0 && amount < target;
          return false;
        });
      });
    }
    return result;
  }, [searchTerm, filterType, students, sortedAllCollections]);

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
    if (navigator.vibrate) navigator.vibrate(5);
  };

  const handleHeaderPressStart = () => {
    headerLongPressTimer.current = window.setTimeout(() => {
      setIsFrozen(prev => !prev);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleHeaderPressEnd = () => {
    if (headerLongPressTimer.current) {
      clearTimeout(headerLongPressTimer.current);
      headerLongPressTimer.current = null;
    }
  };

  // Resize Logic
  const startResizing = useCallback((clientX: number) => {
    setIsResizing(true);
    resizeStartX.current = clientX;
    resizeStartWidth.current = frozenWidth;
  }, [frozenWidth]);

  const onResizing = useCallback((clientX: number) => {
    if (!isResizing) return;
    const delta = (clientX - resizeStartX.current) / zoomScale;
    const newWidth = Math.max(100, Math.min(500, resizeStartWidth.current + delta));
    setFrozenWidth(newWidth);
  }, [isResizing, zoomScale]);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => onResizing(e.clientX);
      const handleTouchMove = (e: TouchEvent) => onResizing(e.touches[0].clientX);
      const handleMouseUp = () => stopResizing();
      const handleTouchEnd = () => stopResizing();

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchend', handleTouchEnd);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isResizing, onResizing, stopResizing]);

  const resetZoom = () => {
    setZoomScale(1.0);
    if (navigator.vibrate) navigator.vibrate(5);
  };

  const handleAmountCellClick = (collectionId: string, studentId: string) => {
    if (isScrollingRef.current) return;
    
    const now = Date.now();
    const key = `${collectionId}-${studentId}`;
    const lastClick = lastClickTimeRef.current[key] || 0;
    
    // Highlight row on single click
    setHighlightedStudentId(prev => prev === studentId ? null : studentId);

    if (now - lastClick < 300) {
      // It's a double click!
      onSelectStudentPayment(collectionId, studentId);
      if (navigator.vibrate) navigator.vibrate(10);
      delete lastClickTimeRef.current[key];
    } else {
      lastClickTimeRef.current[key] = now;
      // Clear after threshold to avoid stale clicks
      setTimeout(() => {
        if (lastClickTimeRef.current[key] === now) {
            delete lastClickTimeRef.current[key];
        }
      }, 400);
    }
  };

  const toggleSearch = () => {
    setIsSearchOpen(prev => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } else {
        setSearchTerm('');
      }
      return next;
    });
  };

  // Computed optical styles
  const opticalStyle = {
      fontSize: `${14 * zoomScale}px`,
      lineHeight: `${20 * zoomScale}px`,
  };
  
  const headerFontSize = `${10 * zoomScale}px`;
  const paddingX = `${16 * zoomScale}px`;
  const paddingY = `${16 * zoomScale}px`;
  const frozenColWidth = `${frozenWidth * zoomScale}px`;
  const dataColWidth = `${140 * zoomScale}px`;

  return (
    <div className={`flex flex-col bg-slate-50 transition-all duration-300 h-full ${isFullScreen ? 'fixed inset-0 z-[100] w-screen p-0' : ''}`}>
      <div className={`sticky top-0 z-50 bg-white shadow-sm px-4 py-4 border-b border-slate-200 ${isFullScreen ? 'shadow-sm' : ''}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                {isFullScreen && (
                    <button onClick={toggleFullScreen} className="p-2 -ml-2 text-slate-500 hover:text-blue-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                )}
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Students</h1>
                  <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[180px]">Manage your roster</p>
                </div>
            </div>
            <div className="flex items-center space-x-1">
                {/* Search Toggle Icon */}
                <button 
                    onClick={toggleSearch}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 ${isSearchOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>

                {zoomScale !== 1.0 && (
                    <button onClick={resetZoom} className="px-2 py-1 text-[10px] font-black uppercase bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors">
                        {Math.round(zoomScale * 100)}%
                    </button>
                )}
                {!isFullScreen && (
                    <button
                        onClick={toggleFullScreen}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        title="View Full Screen"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    </button>
                )}
                <button onClick={handleExport} className="p-2 text-purple-600 hover:bg-purple-50 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
                <button onClick={() => setIsImportModalOpen(true)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </button>
                <button onClick={() => setIsAddModalOpen(true)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>
            </div>
          </div>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSearchOpen ? 'max-h-48 mt-4 opacity-100' : 'max-h-0 mt-0 opacity-0'}`}>
            <div className="flex flex-col gap-3 pb-2">
                <div className="relative flex-1">
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-11 py-3.5 rounded-full bg-slate-50 border border-slate-200 focus:outline-none placeholder-slate-400 text-slate-700 shadow-[0_2px_4px_rgba(0,0,0,0.02)] transition-all font-medium focus:bg-white"
                    />
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    {searchTerm && (
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                        <button onClick={() => setSearchTerm('')} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full focus:outline-none bg-slate-100/50 active:scale-90 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    )}
                </div>
                <div className="flex bg-white p-1 rounded-full ring-1 ring-slate-200 shadow-sm self-start">
                    <button onClick={() => setFilterType('all')} className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase transition-all ${filterType === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>All</button>
                    <button onClick={() => setFilterType('credit')} className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase transition-all ${filterType === 'credit' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Credit</button>
                    <button onClick={() => setFilterType('debit')} className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase transition-all ${filterType === 'debit' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Debit</button>
                </div>
            </div>
        </div>
      </div>

       <div className="flex-1 min-h-0 overflow-hidden relative">
       {students.length > 0 ? (
          filteredStudents.length > 0 ? (
            <div 
                ref={tableContainerRef} 
                className={`overflow-auto bg-white h-full ${isResizing ? 'cursor-col-resize select-none' : ''}`}
                style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
            >
                <table className="min-w-full divide-y divide-slate-100 border-separate border-spacing-0">
                    <thead className="sticky top-0 z-40">
                        <tr>
                            <th 
                                scope="col" 
                                onMouseDown={handleHeaderPressStart}
                                onMouseUp={handleHeaderPressEnd}
                                onMouseLeave={handleHeaderPressEnd}
                                onTouchStart={handleHeaderPressStart}
                                onTouchEnd={handleHeaderPressEnd}
                                style={{ 
                                    width: isFrozen ? frozenColWidth : 'auto', 
                                    minWidth: isFrozen ? frozenColWidth : frozenColWidth,
                                    maxWidth: isFrozen ? frozenColWidth : 'none',
                                    fontSize: headerFontSize,
                                    paddingLeft: paddingX,
                                    paddingRight: paddingX,
                                    paddingTop: paddingY,
                                    paddingBottom: paddingY,
                                }}
                                className={`text-left font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 select-none transition-shadow duration-300 relative ${isFrozen ? 'sticky left-0 z-50 shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-slate-200' : ''}`}
                            >
                                <div className="flex items-center">
                                    <span className="truncate">Student Name</span>
                                    {isFrozen && (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1.5 text-blue-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" style={{ transform: `scale(${zoomScale})` }}>
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                {isFrozen && (
                                    <div 
                                        onMouseDown={(e) => { e.stopPropagation(); startResizing(e.clientX); }}
                                        onTouchStart={(e) => { e.stopPropagation(); startResizing(e.touches[0].clientX); }}
                                        className={`absolute top-0 right-0 w-3 h-full cursor-col-resize z-[60] hover:bg-blue-400/20 transition-colors ${isResizing ? 'bg-blue-500/30' : ''}`}
                                        title="Drag to resize"
                                    />
                                )}
                            </th>
                            {sortedAllCollections.map(collection => {
                                const isRemitted = 'remittance' in collection;
                                let headerText = collection.name;
                                if (collection.type === 'ulikdanay') {
                                    const month = collection.name.match(/Month of (\w+)/)?.[1];
                                    if (month) headerText = month;
                                }
                                return (
                                <th 
                                    key={collection.id} 
                                    scope="col" 
                                    onClick={() => onSelectCollection(collection)} 
                                    style={{
                                        width: dataColWidth,
                                        minWidth: dataColWidth,
                                        fontSize: headerFontSize,
                                        paddingLeft: paddingX,
                                        paddingRight: paddingX,
                                        paddingTop: paddingY,
                                        paddingBottom: paddingY,
                                    }}
                                    className={`text-left font-bold uppercase tracking-wider whitespace-nowrap bg-slate-50 border-b border-slate-200 cursor-pointer transition-colors active:bg-slate-100 ${isRemitted ? 'text-emerald-600' : 'text-slate-500'}`}
                                >
                                    <div className="truncate" title={collection.name}>{headerText}</div>
                                </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {filteredStudents.map((student) => (
                            <tr key={student.id} className={`${highlightedStudentId === student.id ? 'bg-blue-50' : 'hover:bg-slate-50'} transition-colors`}>
                                <td 
                                    style={{ 
                                        width: isFrozen ? frozenColWidth : 'auto', 
                                        minWidth: isFrozen ? frozenColWidth : frozenColWidth, 
                                        maxWidth: isFrozen ? frozenColWidth : 'none',
                                        fontSize: opticalStyle.fontSize,
                                        paddingLeft: paddingX,
                                        paddingRight: paddingX,
                                        paddingTop: paddingY,
                                        paddingBottom: paddingY,
                                    }}
                                    className={`whitespace-nowrap font-semibold text-slate-800 prevent-select border-b border-slate-100 cursor-pointer transition-shadow duration-300 relative ${highlightedStudentId === student.id ? 'bg-blue-50' : 'bg-white'} ${isFrozen ? 'sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] border-r border-slate-100' : ''}`} 
                                    onClick={() => { if (!isScrollingRef.current) setHighlightedStudentId(prev => prev === student.id ? null : student.id); }}
                                >
                                    <div className="flex items-center">
                                        <div className="truncate">{student.studentName}</div>
                                        {student.notes && <div className="ml-1.5 rounded-full bg-blue-400 flex-shrink-0" style={{ width: `${6*zoomScale}px`, height: `${6*zoomScale}px` }}></div>}
                                    </div>
                                    {isFrozen && <div className={`absolute top-0 right-0 w-px h-full ${isResizing ? 'bg-blue-200' : 'bg-slate-100'}`} />}
                                </td>
                                {sortedAllCollections.map(collection => {
                                    const isRemitted = 'remittance' in collection;
                                    const isStudentIncluded = !collection.includedStudentIds || collection.includedStudentIds.includes(student.id);
                                    
                                    const commonCellStyles = {
                                        width: dataColWidth,
                                        minWidth: dataColWidth,
                                        fontSize: opticalStyle.fontSize,
                                        paddingLeft: paddingX,
                                        paddingRight: paddingX,
                                        paddingTop: paddingY,
                                        paddingBottom: paddingY,
                                    };

                                    if (!isStudentIncluded) return <td key={collection.id} style={commonCellStyles} className="text-center text-slate-200 border-b border-slate-100">—</td>;
                                    
                                    const payment = collection.payments.find(p => p.studentId === student.id);
                                    const amount = payment?.amount || 0;
                                    const target = getStudentTargetAmount(collection, payment);
                                    let cellClass = "";
                                    let textClass = isRemitted ? "text-emerald-600 font-black" : "text-slate-400";
                                    
                                    if (amount > 0 && !isRemitted) {
                                        if (target > 0) {
                                            if (amount > target) { cellClass = "bg-blue-50/50"; textClass = "text-blue-600 font-black"; }
                                            else if (amount < target) { cellClass = "bg-rose-50/50"; textClass = "text-rose-600 font-black"; }
                                            else { textClass = "text-slate-800 font-bold"; }
                                        } else { textClass = "text-slate-800 font-bold"; }
                                    }
                                    
                                    return (
                                        <td 
                                            key={collection.id} 
                                            style={commonCellStyles}
                                            className={`whitespace-nowrap text-sm cursor-pointer border-b border-slate-100 transition-colors active:opacity-60 ${cellClass}`} 
                                            onClick={() => handleAmountCellClick(collection.id, student.id)}
                                        >
                                            <span className={textClass}>₱{amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          ) : (
            <div className="text-center p-12 bg-white rounded-2xl shadow-sm border border-slate-100 mt-4 mx-4"><h3 className="text-lg font-bold text-slate-700">No results found</h3><p className="text-slate-500 mt-1 text-sm">Adjust search or filters.</p></div>
          )
        ) : (
          <div className="text-center p-12 bg-white rounded-2xl shadow-sm border border-slate-100 mt-4 mx-4"><h3 className="font-bold text-slate-900">Welcome!</h3><p className="mt-2 text-slate-500 max-w-xs mx-auto">Import your class list to start tracking.</p></div>
        )}
       </div>

      <AddStudentModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAddStudent={handleAddStudent} />
      <ImportStudentsModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} existingStudents={students} onConfirmImport={handleImportStudents} />
    </div>
  );
};

export default StudentsScreen;
