
import React from 'react';
import { Student, Payment, Collection, RemittedCollection, CustomField, CustomFieldOption } from '../types';
import { getStudentTargetAmount } from '../screens/CollectionDetailScreen';

interface StudentPaymentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  payment: Payment | undefined;
  collection: Collection | RemittedCollection;
}

const getRelativeTimeString = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 10) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 172800) return 'Yesterday';
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const RenderPaymentCustomFields: React.FC<{
  fields: CustomField[];
  payment: Payment;
  isSublevel?: boolean;
}> = ({ fields, payment, isSublevel = false }) => {
  return (
    <>
      {fields.map(field => {
        const value = payment.customFieldValues?.[field.id];
        if (!value || !value.trim()) return null;

        return (
          <div key={field.id} className={isSublevel ? "mt-2" : ""}>
            <dt className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{field.name}:</dt>
            
            {(field.type === 'option' || field.type === 'checkbox') && field.options ? (
              <dd className="text-sm text-slate-800 mt-1 pl-2 font-medium">
                {value.split(', ').map(selectedValue => {
                  const selectedOption = field.options?.find(o => o.value === selectedValue);
                  if (!selectedOption) return (
                    <div key={selectedValue} className="mt-1">{selectedValue}</div>
                  );

                  const subFieldsForOption = field.subFields?.[selectedOption.id];
                  
                  return (
                    <div key={selectedOption.id} className="mt-1">
                      <p>
                        {selectedValue}
                        {typeof selectedOption.amount === 'number' ? (
                          <span className="font-bold text-blue-600"> (₱{selectedOption.amount.toLocaleString()})</span>
                        ) : ''}
                      </p>
                      {subFieldsForOption && (
                        <div className="pl-4 border-l-2 border-slate-100 mt-2">
                          <RenderPaymentCustomFields
                            fields={subFieldsForOption}
                            payment={payment}
                            isSublevel={true}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </dd>
            ) : (
              <dd className="text-sm text-slate-800 pl-2 font-medium">{value}</dd>
            )}
          </div>
        );
      })}
    </>
  );
};


const StudentPaymentDetailModal: React.FC<StudentPaymentDetailModalProps> = ({ isOpen, onClose, student, payment, collection }) => {
  if (!isOpen) return null;

  const studentTargetAmount = getStudentTargetAmount(collection, payment);

  const getStatusInfo = () => {
    let statusText = 'Not Paid';
    let statusColor = 'text-slate-500';
    let statusBg = 'bg-slate-100';
    const amountPaid = payment?.amount || 0;
    
    if (amountPaid > 0) {
      if (studentTargetAmount > 0) {
        const balance = amountPaid - studentTargetAmount;
        if (balance > 0) {
          statusText = `Credit: ₱${balance.toLocaleString()}`;
          statusColor = 'text-blue-600';
          statusBg = 'bg-blue-50';
        } else if (balance < 0) {
          statusText = `Debit: ₱${Math.abs(balance).toLocaleString()}`;
          statusColor = 'text-rose-600';
          statusBg = 'bg-rose-50';
        } else {
          statusText = 'Fully Paid';
          statusColor = 'text-emerald-600';
          statusBg = 'bg-emerald-50';
        }
      } else {
        statusText = 'Paid';
        statusColor = 'text-emerald-600';
        statusBg = 'bg-emerald-50';
      }
    } else if (payment && payment.amount === 0 && payment.customFieldValues && Object.values(payment.customFieldValues).some(v => v)) {
        statusText = 'Recorded (No Payment)';
        statusColor = 'text-amber-600';
        statusBg = 'bg-amber-50';
    }
    return { statusText, statusColor, statusBg, amountPaid };
  };

  const { statusText, statusColor, statusBg, amountPaid } = getStatusInfo();
  const paymentDate = payment?.timestamp ? new Date(payment.timestamp) : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-down" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Student Record</p>
          <h3 className="text-xl font-black text-slate-900 truncate leading-tight">{student.studentName}</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">ID: {student.studentNo}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Overview Card */}
          <div className={`p-4 rounded-2xl border border-transparent ${statusBg} transition-colors duration-500`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <p className={`text-lg font-bold ${statusColor} leading-none`}>{statusText}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Paid</p>
                    <p className="text-lg font-black text-slate-900 leading-none">₱{amountPaid.toLocaleString()}</p>
                </div>
            </div>
            <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-1000 ease-out ${statusColor.replace('text', 'bg')}`}
                    style={{ width: `${studentTargetAmount > 0 ? Math.min((amountPaid / studentTargetAmount) * 100, 100) : (amountPaid > 0 ? 100 : 0)}%` }}
                />
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 text-center tracking-tighter">
                Target: {studentTargetAmount > 0 ? `₱${studentTargetAmount.toLocaleString()}` : 'N/A'}
            </p>
          </div>
          
          {/* Last Payment Date Field */}
          {paymentDate && (
             <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h4 className="text-xs uppercase font-black text-slate-800 tracking-widest">Last Payment Date</h4>
                </div>
                
                <div className="space-y-3">
                     <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-slate-400 uppercase">Recorded</span>
                        <span className="text-sm font-black text-blue-600">{getRelativeTimeString(paymentDate)}</span>
                    </div>
                     <div className="flex justify-between items-center text-xs text-slate-600 font-medium pt-2 border-t border-slate-50">
                        <span>{paymentDate.toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                        <span>{paymentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            </div>
          )}

          {collection.customFields && collection.customFields.length > 0 && payment && (
            <div className="space-y-3 pt-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Order Details</h4>
              <dl className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <RenderPaymentCustomFields fields={collection.customFields} payment={payment} />
              </dl>
            </div>
          )}

          {student.notes && (
             <div className="space-y-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Student Notes</h4>
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50">
                    <p className="text-xs text-amber-800 leading-relaxed italic">"{student.notes}"</p>
                </div>
             </div>
          )}
        </div>

        <div className="p-6 bg-white border-t border-slate-50">
          <button 
            onClick={onClose} 
            className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-200 active:scale-95 transition-all uppercase text-xs tracking-[0.2em]"
          >
            Close Record
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentPaymentDetailModal;
