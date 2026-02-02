
import { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Collection, RemittedCollection, ArchivedCollection, Student, TreasurerProfile, CustomField, Payment } from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'pulling' | 'permission_denied' | 'quota_exceeded' | 'wiping';

const QUOTA_COOLDOWN_KEY = 'treasapp_quota_cooldown_until';
const SYNC_CACHE_KEY = 'treasapp_sync_hash_cache';
const LAST_FULL_SYNC_TIME_KEY = 'treasapp_last_full_sync_timestamp';

/**
 * Deeply converts Firestore data to plain JS objects.
 */
function toPlainObject(obj: any, seen = new WeakSet()): any {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (seen.has(obj)) return '[Circular]';
    if (Array.isArray(obj)) return obj.map(v => toPlainObject(v, seen));
    if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
    if (obj.path && typeof obj.path === 'string' && (obj.firestore || obj._firestore)) return obj.path; 

    const proto = Object.getPrototypeOf(obj);
    if (proto !== null && proto !== Object.prototype) return String(obj);

    seen.add(obj);
    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            if (typeof val === 'function' || key === 'firestore' || key === '_firestore') continue;
            result[key] = toPlainObject(val, seen);
        }
    }
    return result;
}

function formatCustomFieldsForFirestore(fields: CustomField[] | undefined, payment: Payment, indent: string = ''): string {
    if (!fields || !payment.customFieldValues) return '';
    const lines: string[] = [];
    fields.forEach(field => {
        const rawValue = payment.customFieldValues?.[field.id];
        if (!rawValue || !rawValue.trim()) return;
        lines.push(`${indent}${field.name}: ${rawValue}`);
        if ((field.type === 'option' || field.type === 'checkbox') && field.options) {
            const selectedValues = rawValue.split(', ').filter(Boolean);
            selectedValues.forEach(val => {
                const option = field.options?.find(o => o.value === val);
                if (!option) return;
                const priceSuffix = option.amount ? ` (₱${option.amount})` : '';
                const subFields = field.subFields?.[option.id];
                if (field.type === 'checkbox' || (subFields && subFields.length > 0)) {
                    lines.push(`${indent}  ↳ ${val}${priceSuffix}`);
                    if (subFields) {
                        const subContent = formatCustomFieldsForFirestore(subFields, payment, `${indent}    `);
                        if (subContent) lines.push(subContent);
                    }
                } else if (option.amount) {
                    const lastIdx = lines.length - 1;
                    if (lines[lastIdx] && lines[lastIdx].includes(val)) {
                        lines[lastIdx] = lines[lastIdx].replace(val, `${val}${priceSuffix}`);
                    }
                }
            });
        }
    });
    return lines.join('\n');
}

/**
 * Optimized hash for comparison
 */
function fastHash(obj: any): string {
    return JSON.stringify(obj);
}

export function useFirebaseSync(
    profile: TreasurerProfile,
    students: Student[],
    collections: Collection[],
    remitted: RemittedCollection[],
    archived: ArchivedCollection[],
    setters?: {
        setProfile: (p: TreasurerProfile) => void;
        setStudents: (s: Student[]) => void;
        setCollections: (c: Collection[]) => void;
        setRemitted: (r: RemittedCollection[]) => void;
        setArchived: (a: ArchivedCollection[]) => void;
    }
) {
    const [status, setStatus] = useState<SyncStatus>('idle');
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isHydrated, setIsHydrated] = useState(false);
    const syncInProgress = useRef(false);
    const isRestoring = useRef(false);
    
    // Persistent hash cache to track cloud state across sessions
    const [syncCache, setSyncCache] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem(SYNC_CACHE_KEY);
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem(SYNC_CACHE_KEY, JSON.stringify(syncCache));
    }, [syncCache]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        const timer = setTimeout(() => setIsHydrated(true), 1500);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearTimeout(timer);
        };
    }, []);

    const checkQuotaCooldown = useCallback(() => {
        const cooldownUntil = localStorage.getItem(QUOTA_COOLDOWN_KEY);
        if (cooldownUntil && Date.now() < parseInt(cooldownUntil, 10)) {
            if (status !== 'quota_exceeded') setStatus('quota_exceeded');
            return true;
        }
        if (status === 'quota_exceeded') setStatus('idle');
        return false;
    }, [status]);

    const commitInChunks = async (ops: { type: 'set' | 'delete', ref: any, data?: any }[]) => {
        const CHUNK_SIZE = 50; 
        for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
            const batch = writeBatch(db);
            const chunk = ops.slice(i, i + CHUNK_SIZE);
            if (chunk.length === 0) break;
            chunk.forEach(op => {
                if (op.type === 'set') batch.set(op.ref, op.data, { merge: true });
                else if (op.type === 'delete') batch.delete(op.ref);
            });
            await batch.commit();
        }
    };

    const pushAllToCloud = useCallback(async (isAutoSync: boolean = false, profileOverride?: TreasurerProfile) => {
        const activeProfile = profileOverride || profile;
        const studentIdValue = activeProfile.studentId.trim();
        const isInvalidId = !studentIdValue || studentIdValue === '' || studentIdValue === 'Student ID';
        
        if (syncInProgress.current || isRestoring.current || !isOnline || !isHydrated || isInvalidId || checkQuotaCooldown()) return;
        
        syncInProgress.current = true;
        
        try {
            const operations: { type: 'set' | 'delete', ref: any, data?: any }[] = [];
            const tempCacheUpdates: Record<string, string> = {};

            // 1. Profile Sync
            const profileData = { name: activeProfile.name, studentId: studentIdValue, avatar: activeProfile.avatar || '' };
            const profileHash = fastHash(profileData);
            if (syncCache['profile'] !== profileHash) {
                operations.push({
                    type: 'set',
                    ref: doc(db, 'users', studentIdValue),
                    data: { ...profileData, lastSynced: serverTimestamp() }
                });
                tempCacheUpdates['profile'] = profileHash;
            }

            // 2. Data Diffing (Collections & Student Payments)
            const allColls = isAutoSync ? [...collections, ...remitted] : [...collections, ...remitted, ...archived];
            allColls.forEach(c => {
                const { payments, synced, ...metadata } = c;
                let syncState = 'active';
                if (remitted.some(rc => rc.id === c.id)) syncState = 'remitted';
                else if (archived.some(ac => ac.id === c.id)) syncState = 'archived';

                const collMetaHash = fastHash({ metadata, syncState });
                const metaCacheKey = `coll_meta_${c.id}`;

                if (syncCache[metaCacheKey] !== collMetaHash) {
                    operations.push({
                        type: 'set',
                        ref: doc(db, 'users', studentIdValue, 'collections', c.id),
                        data: { ...metadata, syncState, lastSynced: serverTimestamp() }
                    });
                    tempCacheUpdates[metaCacheKey] = collMetaHash;
                }

                // Sync individual student payments within this collection
                payments.forEach(p => {
                    const student = students.find(s => s.id === p.studentId);
                    if (!student) return;

                    const formattedFields = formatCustomFieldsForFirestore(c.customFields, p);
                    const paymentData = {
                        collectionId: c.id,
                        collectionName: c.name,
                        collectionType: c.type,
                        targetAmount: metadata.targetAmount || 0,
                        amountPaid: p.amount,
                        timestamp: p.timestamp || new Date().toISOString(),
                        formattedCustomFields: formattedFields,
                        studentName: student.studentName,
                        studentNo: student.studentNo
                    };

                    const paymentHash = fastHash(paymentData);
                    const paymentCacheKey = `pay_${c.id}_${p.studentId}`;

                    if (syncCache[paymentCacheKey] !== paymentHash) {
                        operations.push({
                            type: 'set',
                            ref: doc(db, 'users', studentIdValue, 'students', p.studentId, 'payments', c.id),
                            data: { ...paymentData, lastSynced: serverTimestamp() }
                        });
                        
                        operations.push({
                            type: 'set',
                            ref: doc(db, 'users', studentIdValue, 'students', p.studentId),
                            data: { studentName: student.studentName, studentNo: student.studentNo, lastSynced: serverTimestamp() }
                        });

                        tempCacheUpdates[paymentCacheKey] = paymentHash;
                    }
                });
            });

            if (operations.length > 0) {
                setStatus('syncing');
                await commitInChunks(operations);
                setSyncCache(prev => ({ ...prev, ...tempCacheUpdates }));
                setStatus('synced');
            } else {
                setStatus('synced');
            }
        } catch (error: any) {
            console.error("Sync Error:", error);
            if (error.code === 'permission-denied') setStatus('permission_denied');
            else if (error.code === 'resource-exhausted') setStatus('quota_exceeded');
            else setStatus('error');
        } finally {
            syncInProgress.current = false;
        }
    }, [profile, collections, remitted, archived, students, isOnline, isHydrated, syncCache, checkQuotaCooldown]);

    const deleteCollectionsFromCloud = useCallback(async (collectionIds: string[]) => {
        const studentIdValue = profile.studentId.trim();
        if (!isOnline || !studentIdValue) return;
        
        try {
            const operations: { type: 'set' | 'delete', ref: any, data?: any }[] = [];
            collectionIds.forEach(id => {
                // Delete collection metadata from cloud
                operations.push({
                    type: 'delete',
                    ref: doc(db, 'users', studentIdValue, 'collections', id)
                });
                
                // Deep delete: also remove payment sub-documents from students' collection in cloud
                students.forEach(student => {
                    operations.push({
                        type: 'delete',
                        ref: doc(db, 'users', studentIdValue, 'students', student.id, 'payments', id)
                    });
                });
            });
            await commitInChunks(operations);
        } catch (err) {
            console.error("Cloud Deep Delete Failed:", err);
        }
    }, [profile.studentId, isOnline, students]);

    const performFullRestore = useCallback(async (targetId: string) => {
        if (!isOnline || !targetId || isRestoring.current) return false;
        isRestoring.current = true;
        setStatus('pulling');

        try {
            const userRef = doc(db, 'users', targetId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const data = toPlainObject(userSnap.data());
                setters?.setProfile({
                    studentId: data.studentId,
                    name: data.name,
                    avatar: data.avatar || ''
                });
            } else {
                setStatus('error');
                return false;
            }

            const collsSnap = await getDocs(collection(db, 'users', targetId, 'collections'));
            const cloudColls = collsSnap.docs.map(d => ({ ...toPlainObject(d.data()), id: d.id }));
            
            const studentsSnap = await getDocs(collection(db, 'users', targetId, 'students'));
            const cloudStudents: Student[] = [];
            const allPaymentsMap: Record<string, Payment[]> = {};

            for (const sDoc of studentsSnap.docs) {
                const sData = toPlainObject(sDoc.data());
                cloudStudents.push({ id: sDoc.id, studentName: sData.studentName, studentNo: sData.studentNo });

                const pSnap = await getDocs(collection(sDoc.ref, 'payments'));
                pSnap.docs.forEach(pDoc => {
                    const pData = toPlainObject(pDoc.data());
                    if (!allPaymentsMap[pData.collectionId]) allPaymentsMap[pData.collectionId] = [];
                    allPaymentsMap[pData.collectionId].push({
                        studentId: sDoc.id,
                        amount: pData.amountPaid,
                        timestamp: pData.timestamp
                    });
                });
            }

            const finalActive: Collection[] = [];
            const finalRemitted: RemittedCollection[] = [];
            const finalArchived: ArchivedCollection[] = [];

            cloudColls.forEach(c => {
                const coll: any = {
                    ...c,
                    payments: allPaymentsMap[c.id] || [],
                    synced: true
                };
                if (c.syncState === 'remitted') finalRemitted.push(coll);
                else if (c.syncState === 'archived') finalArchived.push(coll);
                else finalActive.push(coll);
            });

            setters?.setStudents(cloudStudents);
            setters?.setCollections(finalActive);
            setters?.setRemitted(finalRemitted);
            setters?.setArchived(finalArchived);
            
            localStorage.setItem(LAST_FULL_SYNC_TIME_KEY, Date.now().toString());
            setSyncCache({});
            setStatus('synced');
            return true;
        } catch (err) {
            console.error("Full Restore Error:", err);
            setStatus('error');
            return false;
        } finally {
            isRestoring.current = false;
        }
    }, [isOnline, setters]);

    const clearCloudData = useCallback(async () => {
        const targetId = profile.studentId.trim();
        if (!isOnline || !targetId) return false;
        setStatus('wiping');

        try {
            const ops: { type: 'set' | 'delete', ref: any }[] = [];
            
            const collsSnap = await getDocs(collection(db, 'users', targetId, 'collections'));
            collsSnap.docs.forEach(d => ops.push({ type: 'delete', ref: d.ref }));

            const studentsSnap = await getDocs(collection(db, 'users', targetId, 'students'));
            for (const sDoc of studentsSnap.docs) {
                const pSnap = await getDocs(collection(sDoc.ref, 'payments'));
                pSnap.docs.forEach(pDoc => ops.push({ type: 'delete', ref: pDoc.ref }));
                ops.push({ type: 'delete', ref: sDoc.ref });
            }

            ops.push({ type: 'delete', ref: doc(db, 'users', targetId) });

            await commitInChunks(ops);
            setSyncCache({});
            setStatus('synced');
            return true;
        } catch (err) {
            console.error("Wipe Error:", err);
            setStatus('error');
            return false;
        }
    }, [profile.studentId, isOnline]);

    return { 
        status, 
        pushAllToCloud, 
        performFullRestore, 
        deleteCollectionsFromCloud, 
        clearCloudData 
    };
}
