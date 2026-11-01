/**
 * FIREBASE-CONFIG.JS - Firebase Services & Cloud Configuration Layer
 * Connects the Student Assignment Management System to:
 * 1. Firebase Authentication: Role-based secure student and faculty logins
 * 2. Cloud Firestore: Real-time database for users, subjects, assignments, submissions, marks & feedback
 * 3. Firebase Storage: Cloud storage for assignment resource briefs & completed student file uploads
 * 
 * Includes resilient auto-fallback so the system runs smoothly in local demo mode until live keys are active.
 */

// 1. Primary Firebase Project Web Configuration
// Replace the values below with your credentials from the Firebase Console (Project Settings -> General -> Your apps -> Web app)
let firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Check if custom config was saved via the UI settings modal
try {
  const customConfig = localStorage.getItem("sams_custom_firebase_config");
  if (customConfig) {
    const parsed = JSON.parse(customConfig);
    if (parsed && parsed.apiKey && parsed.projectId) {
      firebaseConfig = { ...firebaseConfig, ...parsed };
    }
  }
} catch (e) {
  console.warn("Could not read custom Firebase config from localStorage", e);
}

// 2. State & Service Singletons
let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let firebaseStorage = null;
let isFirebaseLiveActive = false;

const FirebaseService = {
  /**
   * Checks whether valid live Firebase credentials are present
   */
  isConfigured() {
    return (
      firebaseConfig &&
      firebaseConfig.apiKey &&
      firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" &&
      firebaseConfig.projectId &&
      firebaseConfig.projectId !== "your-project-id"
    );
  },

  /**
   * Returns whether live Firebase services are actively connected
   */
  isLive() {
    return isFirebaseLiveActive && !!firebaseApp && !!firestoreDb;
  },

  /**
   * Get active config object (with masked API key for safe UI display)
   */
  getConfig() {
    return {
      ...firebaseConfig,
      apiKeyMasked: firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY"
        ? firebaseConfig.apiKey.slice(0, 6) + "..." + firebaseConfig.apiKey.slice(-4)
        : "Not Set"
    };
  },

  /**
   * Save custom configuration from the in-app connection modal
   */
  saveConfig(newConfig) {
    if (!newConfig || !newConfig.apiKey || !newConfig.projectId) {
      return { success: false, error: "API Key and Project ID are required." };
    }

    try {
      localStorage.setItem("sams_custom_firebase_config", JSON.stringify(newConfig));
      firebaseConfig = { ...firebaseConfig, ...newConfig };
      this.init();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Clear custom configuration and revert to default/demo mode
   */
  clearConfig() {
    localStorage.removeItem("sams_custom_firebase_config");
    window.location.reload();
  },

  /**
   * Initialize Firebase SDKs
   */
  init() {
    if (typeof firebase === "undefined") {
      console.warn("⚠️ Firebase Compat SDKs not loaded in document head.");
      return false;
    }

    if (!this.isConfigured()) {
      isFirebaseLiveActive = false;
      console.info("ℹ️ Running in local demo mode with sample data. Connect live Firebase in js/firebase-config.js or via in-app settings.");
      return false;
    }

    try {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        firebaseApp = firebase.app();
      }

      firebaseAuth = firebase.auth();
      firestoreDb = firebase.firestore();
      firebaseStorage = firebase.storage();

      // Enable Firestore offline persistence for instant mobile loads
      try {
        firestoreDb.enablePersistence({ synchronizeTabs: true }).catch((err) => {
          if (err.code === "failed-precondition") {
            console.warn("Firestore persistence note: Multiple tabs open, persistence enabled in first tab only.");
          } else if (err.code === "unimplemented") {
            console.warn("Firestore persistence note: Current browser does not support offline persistence.");
          }
        });
      } catch (persistErr) {}

      isFirebaseLiveActive = true;
      console.log("🔥 Firebase initialized successfully in LIVE mode. Connected to project:", firebaseConfig.projectId);

      // Dispatch event for UI status indicators
      window.dispatchEvent(new CustomEvent("firebaseStatusChanged", {
        detail: { isLive: true, projectId: firebaseConfig.projectId }
      }));

      // Seed Firestore with academic baseline data if database is fresh
      this.syncSeedDataToFirestore();

      return true;
    } catch (err) {
      isFirebaseLiveActive = false;
      console.warn("⚠️ Live Firebase initialization error, falling back to local storage:", err.message);
      return false;
    }
  },

  /**
   * Syncs curriculum subjects, other activities, students, and demo assignments to Firestore
   * Ensures sample data is available across all connected phones and clearly tagged as isSample: true.
   */
  async syncSeedDataToFirestore() {
    if (!this.isLive()) return;

    try {
      // 1. Seed Course Subjects (12 subjects)
      const subjectsSnap = await firestoreDb.collection("subjects").limit(1).get();
      if (subjectsSnap.empty) {
        console.log("🌱 First-time setup: Seeding 12 timetable course subjects to Firestore...");
        const batch = firestoreDb.batch();
        SEED_DATA.courseSubjects.forEach((sub) => {
          const ref = firestoreDb.collection("subjects").doc(sub.id);
          batch.set(ref, { ...sub, isSample: true, createdAt: new Date().toISOString() });
        });
        await batch.commit();
      }

      // 2. Seed Academic Activities (7 activities)
      const activitiesSnap = await firestoreDb.collection("activities").limit(1).get();
      if (activitiesSnap.empty) {
        console.log("🌱 First-time setup: Seeding 7 other academic activities to Firestore...");
        const batch = firestoreDb.batch();
        SEED_DATA.otherAcademicActivities.forEach((act) => {
          const ref = firestoreDb.collection("activities").doc(act.id);
          batch.set(ref, { ...act, isSample: true, createdAt: new Date().toISOString() });
        });
        await batch.commit();
      }

      // 3. Seed Students Roster (8 students)
      const studentsSnap = await firestoreDb.collection("users").where("role", "==", "student").limit(1).get();
      if (studentsSnap.empty) {
        console.log("🌱 First-time setup: Seeding 8 sample student accounts to Firestore...");
        const batch = firestoreDb.batch();
        SEED_DATA.students.forEach((stu) => {
          const ref = firestoreDb.collection("users").doc(stu.id);
          batch.set(ref, { ...stu, role: "student", isSample: true, createdAt: new Date().toISOString() });
        });
        // Seed Faculty (Prof. Clara)
        const facRef = firestoreDb.collection("users").doc(SEED_DATA.faculty.id);
        batch.set(facRef, { ...SEED_DATA.faculty, isSample: true, createdAt: new Date().toISOString() });
        await batch.commit();
      }

      // 4. Seed Initial Assignments (clearly labeled with isSample: true)
      const assignmentsSnap = await firestoreDb.collection("assignments").limit(1).get();
      if (assignmentsSnap.empty) {
        console.log("🌱 First-time setup: Seeding sample assignments to Firestore...");
        const batch = firestoreDb.batch();
        SEED_DATA.assignments.forEach((asg) => {
          const ref = firestoreDb.collection("assignments").doc(asg.id);
          batch.set(ref, { ...asg, isSample: true });
        });
        SEED_DATA.submissions.forEach((sub) => {
          const ref = firestoreDb.collection("submissions").doc(sub.id);
          batch.set(ref, { ...sub, isSample: true });
        });
        await batch.commit();
      }

      console.log("✅ Firestore baseline academic records synced and verified.");
    } catch (err) {
      console.warn("Firestore seed synchronization notice (normal if security rules prevent direct writes without auth):", err.message);
    }
  },

  /**
   * Upload an assignment brief or completed student document to Firebase Storage
   * @param {string} folderPath - destination folder (e.g. 'assignments' or 'submissions')
   * @param {File|Blob} file - physical file or blob
   * @param {string} fileName - original file name
   * @returns {Promise<{ downloadUrl: string, storagePath: string, fileName: string }>}
   */
  async uploadFileToStorage(folderPath, file, fileName) {
    if (!this.isLive() || !firebaseStorage) {
      // Local fallback: return object URL / mock reference
      return {
        downloadUrl: file ? URL.createObjectURL(file) : "",
        storagePath: `${folderPath}/${fileName}`,
        fileName: fileName,
        isCloudStored: false
      };
    }

    try {
      const sanitizedName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const fullPath = `${folderPath}/${sanitizedName}`;
      const storageRef = firebaseStorage.ref(fullPath);

      const snapshot = await storageRef.put(file);
      const downloadUrl = await snapshot.ref.getDownloadURL();

      return {
        downloadUrl,
        storagePath: fullPath,
        fileName: fileName,
        isCloudStored: true
      };
    } catch (err) {
      console.warn("Firebase Storage upload error, falling back to local file reference:", err);
      return {
        downloadUrl: file ? URL.createObjectURL(file) : "",
        storagePath: `${folderPath}/${fileName}`,
        fileName: fileName,
        isCloudStored: false,
        error: err.message
      };
    }
  }
};

// Initialize immediately on script evaluation
FirebaseService.init();
