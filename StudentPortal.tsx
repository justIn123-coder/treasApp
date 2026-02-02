
import React, { useState } from 'react';
import { db } from './lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

interface StudentPaymentRecord {
    collectionId: string;
    collectionName: string;
    collectionType: string;
    targetAmount: number;
    amountPaid: number;
    timestamp?: string;
    customFieldValues?: { [key: string]: string };
    formattedCustomFields?: string; // New field from cloud
}

const StudentPortal: React.FC = () => {
    const [classCode, setClassCode] = useState('2025-S00005'); // Default Treasurer
    const [myId, setMyId] = useState(''); // The Student's own ID
    const [results, setResults] = useState<StudentPaymentRecord[]>([]);
    const [studentName, setStudentName] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkFunds = async () => {
        if (!classCode || !myId) return;
        setLoading(true);
        setError(null);
        setResults([]);
        setStudentName(null);

        try {
            const studentRef = doc(db, 'users', classCode.trim(), 'students', myId.trim());
            const studentSnap = await getDoc(studentRef);
            
            if (!studentSnap.exists()) {
                setError("No student profile found with this ID in this class.");
                setLoading(false);
                return;
            }
            setStudentName(studentSnap.data().studentName);

            const paymentsRef = collection(studentRef, 'payments');
            const querySnapshot = await getDocs(paymentsRef);
            
            if (querySnapshot.empty) {
                setError("No payment records found for you yet.");
                setLoading(false);
                return;
            }

            const foundRecords: StudentPaymentRecord[] = [];
            querySnapshot.forEach((doc) => {
                foundRecords.push(doc.data() as StudentPaymentRecord);
            });

            setResults(foundRecords.sort((a, b) => 
                (b.timestamp || '').localeCompare(a.timestamp || '')
            ));
        } catch (err) {
            console.error(err);
            setError("Could not retrieve your records. Please check your Class Code and connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans">
            <header className="mb-8 text-center">
                <div className="inline-block p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">TreasCheck</h1>
                <p className="text-slate-500 font-medium">Personal Payment Ledger</p>
            </header>

            <div className="max-w-md mx-auto space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Class Code (Treasurer ID)</label>
                        <input 
                            type="text" 
                            value={classCode}
                            onChange={(e) => setClassCode(e.target.value)}
                            placeholder="e.g. 2025-S00005"
                            className="w-full px-4 py-3.5 bg-slate-50 rounded-xl border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Your Student ID</label>
                        <input 
                            type="text" 
                            value={myId}
                            onChange={(e) => setMyId(e.target.value)}
                            placeholder="Enter Your ID"
                            className="w-full px-4 py-3.5 bg-slate-50 rounded-xl border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm"
                        />
                    </div>
                    <button 
                        onClick={checkFunds}
                        disabled={loading}
                        className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Accessing Ledger...
                            </span>
                        ) : 'View My Payments'}
                    </button>
                </div>

                {error && (
                    <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-center text-sm font-bold border border-rose-100 animate-pulse">
                        {error}
                    </div>
                )}

                {studentName && (
                    <div className="px-1 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                            Statement for: <span className="text-slate-900">{studentName}</span>
                        </h2>
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Verified</span>
                    </div>
                )}

                <div className="space-y-4">
                    {results.map((res, i) => {
                        const paid = res.amountPaid || 0;
                        const balance = paid - res.targetAmount;
                        
                        return (
                            <div key={i} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden group hover:border-blue-200 transition-colors">
                                <div className="p-5 flex justify-between items-start">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h3 className="font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{res.collectionName}</h3>
                                        <div className="flex items-center mt-1 space-x-2">
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{res.collectionType}</span>
                                            <p className="text-[11px] text-slate-400">
                                                {res.timestamp ? new Date(res.timestamp).toLocaleDateString() : 'Pending'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-slate-900 leading-tight">₱{paid.toLocaleString()}</p>
                                        <p className={`text-[10px] font-black uppercase tracking-tighter ${balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {balance === 0 ? 'Paid' : balance > 0 ? `Credit: ₱${balance}` : `Bal: ₱${Math.abs(balance)}`}
                                        </p>
                                    </div>
                                </div>
                                
                                {res.formattedCustomFields && (
                                    <div className="px-5 pb-5 pt-1">
                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Order Details</p>
                                            <pre className="text-xs text-slate-600 font-sans whitespace-pre-wrap leading-relaxed">
                                                {res.formattedCustomFields}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <footer className="mt-12 text-center">
                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.3em]">TreasApp Secure Ledger v2.1</p>
            </footer>
        </div>
    );
};

export default StudentPortal;
