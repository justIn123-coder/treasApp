
import React, { useState, useMemo, useRef } from 'react';
import { useCollections } from '../contexts/CollectionsContext';
import { useRemittedCollections } from '../contexts/RemittedCollectionsContext';
import CashOnHandBreakdownModal from '../components/CashOnHandBreakdownModal';

interface Transaction {
  id: string;
  name: string;
  amount: number;
  date: Date;
  type: 'remittance';
}

const FundsScreen: React.FC = () => {
  const { collections } = useCollections();
  const { remittedCollections } = useRemittedCollections();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const totalCashOnHand = collections.reduce((total, collection) => {
    const collectionTotal = collection.payments.reduce((sum, payment) => sum + payment.amount, 0);
    return total + collectionTotal;
  }, 0);

  const remittanceHistory: Transaction[] = remittedCollections.map(collection => {
    const totalRemitted = collection.payments.reduce((sum, p) => sum + p.amount, 0);
    return {
      id: collection.id,
      name: `Remitted: ${collection.name}`,
      amount: -totalRemitted,
      date: new Date(collection.remittance.remittedAt),
      type: 'remittance'
    };
  });
  
  const sortedHistory = useMemo(() => 
    remittanceHistory.sort((a, b) => b.date.getTime() - a.date.getTime()), 
    [remittanceHistory]
  );
  
  const filteredHistory = useMemo(() => {
    if (!searchTerm) {
      return sortedHistory;
    }
    return sortedHistory.filter(transaction =>
      transaction.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, sortedHistory]);

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

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-30 bg-white shadow-sm border-b border-slate-100">
        <div className="px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Funds</h1>
              <p className="text-sm text-slate-500 mt-0.5">Financial overview</p>
            </div>
            <button 
                onClick={toggleSearch}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 ${isSearchOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </button>
          </div>

          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSearchOpen ? 'max-h-24 mt-4 opacity-100' : 'max-h-0 mt-0 opacity-0'}`}>
            <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-11 py-3.5 rounded-full bg-slate-50 border border-slate-200 focus:outline-none placeholder-slate-400 text-slate-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-medium focus:bg-white"
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchTerm && (
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                    <button onClick={() => setSearchTerm('')} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full focus:outline-none bg-slate-100/50 active:scale-90 transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 pb-32">
        {/* Cash on Hand Card */}
        <button 
          onClick={() => setIsBreakdownModalOpen(true)}
          className="w-full bg-white rounded-3xl shadow-sm p-6 mb-8 text-left border border-slate-100 transition-all active:scale-[0.98]"
          aria-label="View cash on hand breakdown"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Cash-on-Hand</p>
              <p className="text-4xl font-black text-blue-600 mt-1 tracking-tight">
                ₱{totalCashOnHand.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-2xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-4">Tap to see active collection details</p>
        </button>

        {/* Transaction History */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-4 px-1">Transaction History</h2>

          {sortedHistory.length > 0 ? (
            filteredHistory.length > 0 ? (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <ul className="divide-y divide-slate-50">
                  {filteredHistory.map(transaction => (
                    <li key={transaction.id} className="p-5 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div className="min-w-0 flex-1 mr-4">
                        <p className="font-bold text-slate-800 truncate">{transaction.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {transaction.date.toLocaleDateString()} &middot; {transaction.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <p className="font-black text-rose-500 whitespace-nowrap">
                        - ₱{Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-20 px-4">
                  <div className="flex justify-center items-center mb-4">
                      <div className="bg-white rounded-full p-4 shadow-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                             <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                          </svg>
                      </div>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700">No transactions found</h3>
                  <p className="text-slate-500 mt-2">Try adjusting your search.</p>
              </div>
            )
          ) : (
            <div className="text-center py-20 px-4">
              <div className="flex justify-center items-center mb-4">
                  <div className="bg-white rounded-full p-6 shadow-sm border border-slate-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                  </div>
              </div>
              <h3 className="text-xl font-bold text-slate-800">No Transactions Yet</h3>
              <p className="text-slate-500 mt-2 max-w-xs mx-auto">When you remit a collection, the transaction will appear here as a deduction.</p>
            </div>
          )}
        </div>
      </div>

      <CashOnHandBreakdownModal
        isOpen={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
        collections={collections}
        totalCashOnHand={totalCashOnHand}
      />
    </div>
  );
};

export default FundsScreen;
