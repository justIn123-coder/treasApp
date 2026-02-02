
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Collection, CustomField, ValueSet } from '../types';
import { CustomFieldBuilder } from '../components/CollectionFormComponents';
import { useValueSets } from '../contexts/ValueSetsContext';
import { useFirebaseSync } from '../hooks/useFirebaseSync';
import { useProfile } from '../contexts/ProfileContext';
import { useStudents } from '../contexts/StudentsContext';
import { useCollections } from '../contexts/CollectionsContext';
import { useRemittedCollections } from '../contexts/RemittedCollectionsContext';
import { useArchivedCollections } from '../contexts/ArchivedCollectionsContext';

interface EditCollectionScreenProps {
  collection: Collection;
  onBack: () => void;
  onSave: (updatedCollection: Collection) => void;
  collections: Collection[];
}

const EditCollectionScreen: React.FC<EditCollectionScreenProps> = ({ collection, onBack, onSave, collections }) => {
  const { valueSets, setValueSets } = useValueSets();
  const { profile } = useProfile();
  const { students } = useStudents();
  const { setCollections } = useCollections();
  const { remittedCollections, setRemittedCollections } = useRemittedCollections();
  const { archivedCollections, setArchivedCollections } = useArchivedCollections();

  const { deleteCollectionsFromCloud } = useFirebaseSync(
    profile, students, collections, remittedCollections, archivedCollections,
    {
        setProfile: () => {}, 
        setStudents: () => {},
        setCollections,
        setRemitted: setRemittedCollections,
        setArchived: setArchivedCollections
    }
  );

  const [name, setName] = useState(collection.name);
  const [targetAmount, setTargetAmount] = useState(collection.targetAmount?.toString() || '');
  const [deadline, setDeadline] = useState(collection.deadline ? new Date(collection.deadline).toISOString().split('T')[0] : '');
  const [notes, setNotes] = useState(collection.notes || '');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const allDefinedFields = useMemo(() => {
    const getAllFields = (fields: CustomField[]): CustomField[] => {
      return fields.flatMap(field => {
        const subFields = (field.type === 'option' || field.type === 'checkbox') && field.subFields
          ? Object.values(field.subFields).flatMap(getAllFields)
          : [];
        return [field, ...subFields];
      });
    };
    return getAllFields(customFields);
  }, [customFields]);

  const [nameError, setNameError] = useState<string | null>(null);
  const [deadlineError, setDeadlineError] = useState<string | null>(null);

  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setTargetAmount(collection.targetAmount?.toString() || '');
      setDeadline(collection.deadline ? new Date(collection.deadline).toISOString().split('T')[0] : '');
      setNotes(collection.notes || '');
      setCustomFields(collection.customFields ? JSON.parse(JSON.stringify(collection.customFields)) : []);
    }
  }, [collection]);

  useEffect(() => {
    if (deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(deadline);

      if (deadlineDate < today) {
        setDeadlineError('Deadline cannot be in the past.');
      } else {
        setDeadlineError(null);
      }
    } else {
      setDeadlineError(null);
    }
  }, [deadline]);

  useEffect(() => {
    if (name && collections.some(c => c.id !== collection.id && c.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      setNameError('Another collection with this name already exists.');
    } else {
      setNameError(null);
    }
  }, [name, collection.id, collections]);
  
  const getValidCustomFields = (fields: CustomField[]): CustomField[] => {
    return fields
      .map(field => {
        const newField: CustomField = { ...field };
        newField.name = field.name.trim();

        if (field.type !== 'text' && newField.options) {
          newField.options = newField.options.map(o => ({ ...o, value: o.value.trim() })).filter(o => o.value);
        } else {
          delete newField.options;
        }

        if ((field.type === 'option' || field.type === 'checkbox') && field.subFields) {
            const validSubFields: { [key: string]: CustomField[] } = {};
            Object.entries(field.subFields).forEach(([optionId, subFields]) => {
                const validSubs = getValidCustomFields(subFields);
                if (validSubs.length > 0) {
                    validSubFields[optionId] = validSubs;
                }
            });
            if (Object.keys(validSubFields).length > 0) {
                newField.subFields = validSubFields;
            } else {
                delete newField.subFields;
            }
        } else {
            delete newField.subFields;
        }

        return newField;
      })
      .filter(f => f.name && (f.type === 'text' || (f.options && f.options.length > 0)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || nameError || deadlineError) return;

    const validFields = getValidCustomFields(customFields);

    const updatedCollection: Collection = {
      ...collection,
      name,
      targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
      deadline: deadline || undefined,
      customFields: validFields.length > 0 ? validFields : undefined,
      notes: notes.trim() || undefined,
      synced: false, 
    };
    onSave(updatedCollection);
  };

  const handleDelete = async () => {
      // Optimistic delete
      setCollections(prev => prev.filter(c => c.id !== collection.id));
      setShowDeleteConfirm(false);
      onBack();
      
      // Background cloud sync
      await deleteCollectionsFromCloud([collection.id]);
  };

  const isUlikdanay = collection.type === 'ulikdanay';
  const isFormValid = !nameError && !deadlineError && name.trim();

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-white shadow-sm p-4 flex items-center z-20 sticky top-0">
        <button onClick={onBack} className="mr-4 text-gray-600 hover:text-blue-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 truncate">
            Edit Collection
        </h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} ref={formRef} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <section className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Core Details</h3>
              <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Collection Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm read-only:bg-gray-100"
                      required
                      readOnly={isUlikdanay}
                    />
                    {nameError && <p className="mt-1 text-sm text-red-600">{nameError}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Target Amount (Optional)</label>
                    <input
                      type="number"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm read-only:bg-gray-100"
                      min="0"
                      step="0.01"
                      readOnly={isUlikdanay}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Deadline (Optional)</label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    {deadlineError && <p className="mt-1 text-sm text-red-600">{deadlineError}</p>}
                  </div>
                </div>
              </section>

              {collection.type === 'regular' && (
                <>
                  <section className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Optional Details</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notes</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="e.g., Instructions for this collection."
                        rows={3}
                      />
                    </div>
                  </section>
                  <section className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Advanced: Custom Fields</h3>
                    <CustomFieldBuilder
                        fields={customFields}
                        setFields={setCustomFields}
                        copyableFields={allDefinedFields}
                        collection={collection}
                        valueSets={valueSets}
                        setValueSets={setValueSets}
                    />
                  </section>
                </>
              )}

              <section className="pt-4">
                 <button 
                    type="button" 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 p-4 text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl font-bold hover:bg-rose-100 transition-colors"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete Collection
                 </button>
                 <p className="text-[10px] text-center text-slate-400 mt-2 uppercase font-black tracking-widest">Removes local data and cloud backups</p>
              </section>
          </div>
          <footer className="sticky bottom-0 bg-gray-100/90 backdrop-blur-sm p-3 border-t border-gray-200 z-10">
            <div className="flex justify-end space-x-3">
                <button type="button" onClick={onBack} className="px-5 py-2.5 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">Cancel</button>
                <button type="submit" disabled={!isFormValid} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed">Save Changes</button>
            </div>
          </footer>
        </form>
      </main>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-sm p-6 transform transition-all">
                <h3 className="text-xl font-bold text-slate-900">Delete Collection?</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    This will permanently remove <strong>{collection.name}</strong> from your device and cloud backups. This cannot be undone.
                </p>
                <div className="mt-6 flex flex-col gap-2">
                    <button onClick={handleDelete} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-rose-500/20">Confirm Delete</button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="w-full py-3 text-slate-400 font-bold uppercase text-xs">Cancel</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default EditCollectionScreen;
