# 🔥 Firebase Setup & Multi-Device Cloud Sync Guide

This guide explains how your **Student Assignment Management System** connects to Google Firebase for **Authentication**, **Cloud Firestore (Real-Time Database)**, and **Firebase Storage (File & Camera Uploads)**.

---

## 🔒 Data Safety & Sample Data Policy

> [!IMPORTANT]
> **Your existing data is never deleted without asking.**
> * **Sample Academic Data**: The 12 curriculum course subjects, 7 academic activities, Prof. Clara, and 8 students are tagged with `isSample: true` and carry a **`Sample Demo`** badge.
> * **Automatic Fallback**: If you do not provide live Firebase keys or if you are offline, the app seamlessly runs in **Local Demo Mode** using browser storage. All your sample coursework and local testing data remain intact.
> * **Live Cloud Sync**: When connected to Firebase, newly created assignments and student submissions carry `isSample: false` (**`Live Task`** badge) and sync across all phones in real time.

---

## 📋 Step-by-Step Setup Instructions

### Step 1: Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **"Add project"** (or **"Create a project"**).
3. Name your project (e.g., `sams-academic-portal`) and continue.
4. Disable or enable Google Analytics (optional) and click **"Create project"**.

---

### Step 2: Register Web App & Get Config Keys
1. In the Firebase Project Overview, click the **Web icon (`</>`)**.
2. App nickname: `SAMS Web Portal`.
3. Click **"Register app"**.
4. Firebase will display your `firebaseConfig` snippet:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "sams-academic-portal.firebaseapp.com",
     projectId: "sams-academic-portal",
     storageBucket: "sams-academic-portal.appspot.com",
     messagingSenderId: "123456789...",
     appId: "1:123456789:web:abcdef..."
   };
   ```
5. You can connect this in **either of two ways**:
   * **Method A (No Code / Recommended)**: Open the live app, click the **`⚡ Demo Mode`** badge in the top navigation bar, paste your **API Key** and **Project ID**, and click **Save & Connect**.
   * **Method B**: Open [`js/firebase-config.js`](file:///D:/OneDrive/Desktop/student-assignment-management-system/js/firebase-config.js) and replace `YOUR_FIREBASE_API_KEY` and `your-project-id`.

---

### Step 3: Enable Firebase Authentication (Student & Faculty Roles)
1. In the Firebase Console left menu, navigate to **Build ➔ Authentication**.
2. Click **"Get Started"**.
3. Under the **Sign-in method** tab, click **Email/Password**.
4. Toggle **Enable** for Email/Password and click **Save**.
5. *(Optional for manual setup)* Under the **Users** tab, you can add:
   * **Faculty**: `clara@university.edu` (passcode: `faculty123`)
   * **Student**: `shyam.daniel@student.univ.edu` (passcode: `student123`)  
   *(Note: The application also includes auto-provisioning; logging in with sample accounts will create them in Auth automatically!)*

---

### Step 4: Enable Cloud Firestore Database (Real-Time Sync)
1. In the Firebase Console left menu, navigate to **Build ➔ Firestore Database**.
2. Click **"Create database"**.
3. Choose a database location closest to you.
4. Select **"Start in production mode"** and click **Create**.
5. Click on the **Rules** tab, copy the complete contents of [`firestore.rules`](file:///D:/OneDrive/Desktop/student-assignment-management-system/firestore.rules), and click **Publish**.

#### Firestore Collections Created Automatically:
* `/users/{uid}`: Profile details and verified role (`student` or `faculty`).
* `/subjects/{id}`: The 12 curriculum regular course subjects.
* `/activities/{id}`: The 7 other academic activities (Placement, Library, NPTEL, etc.).
* `/assignments/{id}`: Coursework created by Prof. Clara with deadlines and instructions.
* `/submissions/{id}`: Student turn-ins, attachments, marks awarded, and faculty feedback.

---

### Step 5: Enable Firebase Storage (Course Briefs & Camera Photos)
1. In the Firebase Console left menu, navigate to **Build ➔ Storage**.
2. Click **"Get Started"**.
3. Choose **"Start in production mode"** and click **Create**.
4. Click on the **Rules** tab, copy the complete contents of [`storage.rules`](file:///D:/OneDrive/Desktop/student-assignment-management-system/storage.rules), and click **Publish**.

#### Storage Folders:
* `/assignments/{assignmentId}/`: Faculty uploaded briefs and scanned course material.
* `/submissions/{userId}/`: Student completed PDF assignments and mobile camera snapshots.

---

## 🔒 Security Model & Role Isolation Summary

* **Students**:
  * Can read all 12 course subjects, academic activities, and assignments.
  * Can upload completed work only into their own user directory (`/submissions/{userId}/`).
  * Can only view their own submissions and grades.
  * **Cannot alter marks, grades, or faculty feedback** (strictly enforced by Firestore Security Rules).
* **Faculty (Prof. Clara)**:
  * Can publish and upload coursework assignments to all or specific students.
  * Can view all submissions from all 8 students.
  * Can record marks, write feedback, and update review statuses (`Pending`, `Submitted`, `Reviewed`, `Late`).
