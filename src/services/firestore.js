import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// Generic Firestore service class
class FirestoreService {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.collectionRef = collection(db, collectionName);
  }

  // Create a new document
  async create(data) {
    const docData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(this.collectionRef, docData);
    return { id: docRef.id, ...docData };
  }

  // Get all documents
  async list(orderByField = 'createdAt') {
    const q = query(this.collectionRef, orderBy(orderByField, 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  // Get document by ID
  async get(id) {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    throw new Error(`Document with ID ${id} not found`);
  }

  // Update document
  async update(id, data) {
    const docRef = doc(db, this.collectionName, id);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(docRef, updateData);
    return { id, ...updateData };
  }

  // Delete document
  async delete(id) {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
    return { id, deleted: true };
  }

  // Filter documents
  async filter(filters, orderByField = 'createdAt') {
    let q = query(this.collectionRef);
    
    // Apply filters
    Object.entries(filters).forEach(([field, value]) => {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && value.$gte) {
          q = query(q, where(field, '>=', value.$gte));
        } else if (typeof value === 'object' && value.$lte) {
          q = query(q, where(field, '<=', value.$lte));
        } else {
          q = query(q, where(field, '==', value));
        }
      }
    });

    // Apply ordering
    if (orderByField.startsWith('-')) {
      q = query(q, orderBy(orderByField.substring(1), 'desc'));
    } else {
      q = query(q, orderBy(orderByField, 'asc'));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  // Real-time listener
  onSnapshot(callback, errorCallback) {
    return onSnapshot(
      this.collectionRef,
      callback,
      errorCallback
    );
  }

  // Real-time listener with filters
  onSnapshotWithFilters(filters, callback, errorCallback) {
    let q = query(this.collectionRef);
    
    Object.entries(filters).forEach(([field, value]) => {
      if (value !== null && value !== undefined) {
        q = query(q, where(field, '==', value));
      }
    });

    return onSnapshot(q, callback, errorCallback);
  }
}

export default FirestoreService;