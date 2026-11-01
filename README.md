# Student Assignment Management System 📚

A responsive, lightweight academic web application built with HTML5, CSS3, and JavaScript, featuring an **interactive liquid-style tab switching animation**, **secure role-based authentication**, **Firebase connectivity** (Auth, Firestore, Storage), and dedicated portals for **Students** and **Faculty (Prof. Clara)** based on the academic class timetable.

---

## 🌟 Key Upgrades & Architectural Highlights

### 1. 🎨 Unique Interactive Tab-Switching Animation
- **Sliding Liquid Pill Indicator**:
  - The active tab sits over a smooth sliding indicator pill (`.tab-slider-pill`).
  - When switching between **Student** and **Faculty**, JavaScript calculates the exact tab geometry and glides the pill with a spring-like cubic-bezier curve (`cubic-bezier(0.25, 1, 0.5, 1)`).
  - The selected portal panel smoothly transitions with a subtle scale and vertical slide effect (`@keyframes viewSlideFadeIn`).
- **Tactile Feedback & Accessibility**:
  - Micro-interactions on `:hover` (soft glow highlight) and `:active` (tactile `scale(0.96)` click compression).
  - Accessible tab behavior: ARIA roles (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`), keyboard navigation via Arrow keys, Home, and End, and a high-contrast `:focus-visible` ring.
  - Respects `@media (prefers-reduced-motion: reduce)` for users requiring minimal animation.

### 2. 👩‍🏫 Comprehensive Faculty Features
- **Create & Upload Coursework**:
  - Faculty can create assignments with: Assignment Number, Title, Course Subject, Faculty Name (*Prof. Clara*), Assigned Students (individual student or broadcast to all), Instructions, Due Date, Maximum Marks, and File Attachments.
- **Dedicated Student Submissions & Evaluations Page (`#viewFacultyEvaluations`)**:
  - Displays each student's name, assigned coursework, submission status, uploaded file link/preview, marks, and written remarks.
  - **4 Core Action Buttons**:
    1. **📤 Upload**: Publish new coursework assignments or briefs.
    2. **🔍 Review**: Inspect student submissions and review attached work.
    3. **✅ Mark Completed**: One-click action to verify and set status to Completed / Reviewed.
    4. **💬 Add Feedback**: Open the evaluation modal to enter marks and written feedback.

### 3. 🔒 Secure Role-Based Authentication & Route Guarding
- **URL Hash Route Protection**:
  - Direct URL access (e.g. `#faculty-dashboard`, `#student-dashboard`) is strictly validated.
  - If a student types `#faculty-dashboard` into the browser address bar, the route guard immediately intercepts the attempt, redirects back to their student dashboard, and presents an **"Access Denied: You do not have faculty privileges"** alert.
  - Unauthenticated users attempting to access any dashboard are redirected to the Welcome page.

### 4. 🔥 Firebase Integration (Auth, Firestore, Storage)
- **Firebase Authentication**: User accounts for Faculty and Students.
- **Cloud Firestore**: Real-time collections for `users`, `subjects`, `assignments`, and `submissions`.
- **Firebase Storage**: File upload buckets for instructor assignment briefs (`/assignments/`) and student work files (`/submissions/`).
- **Security Rules**: Production-ready [`firestore.rules`](file:///d:/student-assignment-management-system/firestore.rules) and [`storage.rules`](file:///d:/student-assignment-management-system/storage.rules) ensuring students cannot edit instructor coursework, alter marks, or overwrite other students' submissions.
- **Graceful Fallback Mode**: The application runs seamlessly out-of-the-box using local persistence until your Firebase project keys are plugged into [`js/firebase-config.js`](file:///d:/student-assignment-management-system/js/firebase-config.js). Read [`FIREBASE_SETUP.md`](file:///d:/student-assignment-management-system/FIREBASE_SETUP.md) for step-by-step setup instructions.

---

## 👥 Sample Users

### 1. 👩‍🏫 Faculty Member: Prof. Clara
- **Department**: Department of Engineering & Technology
- **Email**: `clara@university.edu`

### 2. 🎓 8 Sample Students
1. **Shyam Daniel** (`2026-ENG-001`) — *Includes preloaded reviewed, submitted, and late assignments*
2. **Sukita** (`2026-ENG-002`)
3. **Abhishek Jayavarthan** (`2026-ENG-003`)
4. **Daniel** (`2026-ENG-004`)
5. **Priya** (`2026-ENG-005`)
6. **Arun** (`2026-ENG-006`)
7. **Meena** (`2026-ENG-007`)
8. **Rahul** (`2026-ENG-008`)

---

## 📖 Curriculum Structure

### 12 Course Subjects (Counted Automatically)
1. **Machine Design** (`MD-401`)
2. **Industrial Electronics** (`IE-402`)
3. **Embedded Systems and Programming** (`ESP-403`)
4. **Embedded Systems and Programming Laboratory** (`ESPL-404`)
5. **Micro Electromechanical Systems** (`MEMS-405`)
6. **Integrated Automation** (`IA-406`)
7. **Open Elective II – Introduction to [Title TBD]** (`OE-407`)
8. **Mini Project II** (`MP-408`)
9. **Career Course Track 1 – Personnel Psychology and Technical Skills** (`CCT-409`)
10. **Career Course Track 2 – Entrepreneurial and Business Canvas Model** (`CCT-410`)
11. **Career Course Track 3 – Competency Skills for Higher Education** (`CCT-411`)
12. **Career Course Track 4 – Foundation Course on Competitive Exams** (`CCT-412`)

### 7 Other Academic Activities (Non-Credit Sessions)
- **Placement**, **NPTEL**, **Library**, **Group Discussion**, **Club Activities**, **Mentor**, and **HoD**.

---

## 🚀 How to Run & Test

1. Open [**`index.html`**](file:///d:/student-assignment-management-system/index.html) in your browser.
2. **Experience the Liquid Tab Animation**:
   - On the Welcome page, click between **"🎓 Student"** and **"👩‍🏫 Faculty"**.
   - Notice the smooth liquid sliding pill transition, soft glowing borders, and the subtle content fade/scale effect.
   - Use your keyboard (Arrow Left / Arrow Right) to toggle between the tabs.
3. **Test Faculty Features & Evaluations Page**:
   - Log in as **Prof. Clara** (`Faculty Login`).
   - Open the **"📊 Student Submissions & Evaluations"** tab.
   - Review each student's submission status and uploaded files.
   - Try the 4 action buttons: **Upload**, **Review**, **Mark Completed**, and **Add Feedback**.
4. **Test Route Guard Protection**:
   - While logged in as a student, type `#faculty-dashboard` in your browser URL bar.
   - Notice how the router intercepts the attempt, prevents access, and redirects you with an access denied warning!
