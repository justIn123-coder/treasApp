
const CACHE_NAME = 'treasapp-v23';

// Comprehensive list of all files required for the app to function.
// Since we use ES6 modules, every file is a separate network request.
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './index.tsx',
  './App.tsx',
  './types.ts',
  './constants.ts',
  './lib/firebase.ts',
  './hooks/useLocalStorage.ts',
  './hooks/useTheme.ts',
  './hooks/useFirebaseSync.ts',
  './components/BottomNav.tsx',
  './components/NetworkStatus.tsx',
  './components/AddCollectionModal.tsx',
  './components/RemitModal.tsx',
  './components/AddStudentModal.tsx',
  './components/ExportModal.tsx',
  './components/EditStudentModal.tsx',
  './components/CopyPaymentsModal.tsx',
  './components/ImportStudentsModal.tsx',
  './components/StudentPaymentDetailModal.tsx',
  './components/CollectionFormComponents.tsx',
  './components/CashOnHandBreakdownModal.tsx',
  './components/icons/NavIcons.tsx',
  './components/icons/ExtraIcons.tsx',
  './components/icons/StatusIcons.tsx',
  './contexts/StudentsContext.tsx',
  './contexts/CollectionsContext.tsx',
  './contexts/RemittedCollectionsContext.tsx',
  './contexts/ArchivedCollectionsContext.tsx',
  './contexts/ProfileContext.tsx',
  './contexts/ValueSetsContext.tsx',
  './contexts/HistoryContext.tsx',
  './contexts/BadgeSettingsContext.tsx',
  './screens/CollectionScreen.tsx',
  './screens/RemittedScreen.tsx',
  './screens/FundsScreen.tsx',
  './screens/StudentsScreen.tsx',
  './screens/MenuScreen.tsx',
  './screens/CollectionDetailScreen.tsx',
  './screens/ArchivedScreen.tsx',
  './screens/ProfileScreen.tsx',
  './screens/AddCollectionScreen.tsx',
  './screens/EditCollectionScreen.tsx',
  './screens/HistoryScreen.tsx',
  './screens/SettingsScreen.tsx',
  './StudentPortal.tsx',
  
  // CDN dependencies
  'https://cdn.tailwindcss.com',
  'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0',
  'https://www.gstatic.com/firebasejs/11.3.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.3.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/11.3.1/firebase-analytics.js'
];

// 1. Install: Force cache every file before allowing activation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Advanced Pre-caching started...');
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Activate: Purge old versions to keep device clean
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Removing old version:', key);
          return caches.delete(key);
        }
      })
    ))
  );
  self.clients.claim();
});

// 3. Fetch: Cache-First strategy for modules
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // If we have it in cache, return it immediately (even if we are online)
      // This guarantees the app opens instantly without network wait.
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not in cache, fetch it and store it for next time
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const cloned = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return networkResponse;
      }).catch(() => {
        // If fetch fails and it's a navigation (main page), serve index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html').then(response => {
            return response || caches.match('./') || caches.match('index.html');
          });
        }
      });
    })
  );
});
