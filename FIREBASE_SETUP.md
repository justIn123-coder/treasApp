# Resolving Firestore Permission Errors

To fix the sync errors without affecting your other apps in the **bseeportal-3521a** project, follow these steps:

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Select your project: **bseeportal-3521a**.
3.  In the left sidebar, click **Firestore Database**.
4.  Click on the **Rules** tab at the top.
5.  Delete everything currently in the editor and paste the code below. This combines your existing rules with the ones TreasApp needs.
6.  Click **Publish**.

### Consolidated Rules to Paste:
```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // TreasApp Sync Path
    match /users/{userId} {
      allow read, write: if true;
      match /{allSubcollections=**} {
        allow read, write: if true;
      }
    }

    // Existing App Paths
    match /profiles/{uid} {
      allow read: if true; 
      allow write: if request.auth != null; 
    }
    match /friendships/{fid} {
      allow read, write: if request.auth != null;
    }
    match /messages/{mid} {
      allow read, write: if request.auth != null;
    }
    match /conversations/{cid} {
      allow read, write: if request.auth != null;
    }
    match /assignments/{aid} {
      allow read, write: if true;
    }
    match /calendar_events/{eid} {
      allow read, write: if true;
    }
  }
}
```

Wait about 30 seconds for the rules to propagate, then try syncing in TreasApp again. The "Missing or insufficient permissions" error should disappear in the app's Dynamic Island status bar.