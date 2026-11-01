/**
 * AUTH.JS - Role-Based Authentication & Route Guarding
 * Enforces strict role isolation between Student and Faculty accounts.
 * Clean production state: No hardcoded demo passwords or sample profiles.
 * Supports real login, account registration, session persistence, and route protection.
 */

const SESSION_STORAGE_KEY = "sams_active_session_prod";

const AuthService = {
  currentSession: null,

  /**
   * Initializes session from localStorage with integrity verification
   */
  init() {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        if (session && session.role === "faculty") {
          const faculty = StorageService.getFaculty();
          if (faculty && (faculty.id === session.userId || faculty.email === session.email)) {
            this.currentSession = session;
            return;
          } else if (session.firebaseUid) {
            this.currentSession = session;
            return;
          }
        } else if (session && session.role === "student") {
          const student = StorageService.getStudentById(session.studentId);
          if (student || session.firebaseUid) {
            this.currentSession = session;
            return;
          }
        }
      }
      this.currentSession = null;
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      this.currentSession = null;
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  },

  /**
   * Check if a user is currently authenticated
   */
  isAuthenticated() {
    return this.currentSession !== null && !!this.currentSession.role;
  },

  /**
   * Get active user role ('student' or 'faculty')
   */
  getRole() {
    return this.currentSession ? this.currentSession.role : null;
  },

  /**
   * Get current active user object
   */
  getCurrentUser() {
    if (!this.currentSession) return null;

    if (this.currentSession.role === "faculty") {
      const f = StorageService.getFaculty();
      return f || {
        id: this.currentSession.userId || "fac_current",
        name: this.currentSession.name || "Faculty Instructor",
        title: this.currentSession.title || `Prof. ${this.currentSession.name || "Faculty"}`,
        email: this.currentSession.email || "faculty@university.edu",
        department: this.currentSession.department || "Academic Department",
        role: "faculty"
      };
    }

    const student = StorageService.getStudentById(this.currentSession.studentId);
    return student || {
      id: this.currentSession.studentId || "stu_current",
      name: this.currentSession.name || "Student",
      rollNumber: this.currentSession.rollNumber || "ENG-000",
      email: this.currentSession.email || "student@university.edu",
      role: "student"
    };
  },

  /**
   * Validate Student Login Input
   */
  validateStudentLogin(studentId, passcode) {
    const students = StorageService.getStudents();

    if (students.length === 0) {
      return {
        valid: false,
        noAccounts: true,
        error: "No student accounts registered yet. Please create a student account below."
      };
    }

    if (!studentId || !studentId.trim()) {
      return { valid: false, error: "Please select your student profile from the list." };
    }

    const student = StorageService.getStudentById(studentId);
    if (!student) {
      return { valid: false, error: "Selected student profile does not exist in records." };
    }

    if (!passcode || !passcode.trim()) {
      return { valid: false, error: "Student passcode is required." };
    }

    // In local mode, passcode must be at least 4 characters or match student's rollNumber
    if (student.passcode && passcode.trim() !== student.passcode && passcode.trim() !== student.rollNumber) {
      return { valid: false, error: "Incorrect passcode entered." };
    }

    return { valid: true, student };
  },

  /**
   * Register a new student account
   */
  registerStudent(name, rollNumber, email, passcode) {
    if (!name || !name.trim()) return { success: false, error: "Student name is required." };
    if (!rollNumber || !rollNumber.trim()) return { success: false, error: "Roll number is required." };
    if (!passcode || passcode.trim().length < 4) return { success: false, error: "Passcode must be at least 4 characters." };

    const studentRecord = StorageService.saveStudent({
      name: name.trim(),
      rollNumber: rollNumber.trim().toUpperCase(),
      email: email ? email.trim().toLowerCase() : `${rollNumber.trim().toLowerCase()}@student.univ.edu`,
      passcode: passcode.trim()
    });

    return { success: true, student: studentRecord };
  },

  /**
   * Validate Faculty Login Input
   */
  validateFacultyLogin(email, key) {
    if (!email || !email.trim()) {
      return { valid: false, error: "Please enter your university faculty email address." };
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return { valid: false, error: "Please enter a valid email format (e.g. professor@university.edu)." };
    }

    if (!key || !key.trim()) {
      return { valid: false, error: "Faculty access key is required." };
    }

    const existingFaculty = StorageService.getFaculty();
    if (existingFaculty && existingFaculty.email) {
      if (cleanEmail !== existingFaculty.email.toLowerCase()) {
        return {
          valid: false,
          error: `Unrecognized faculty account "${cleanEmail}". Registered email is: ${existingFaculty.email}`
        };
      }
      if (existingFaculty.key && key.trim() !== existingFaculty.key) {
        return { valid: false, error: "Incorrect faculty access key entered." };
      }
    }

    return { valid: true };
  },

  /**
   * Register or initialize faculty account
   */
  registerFaculty(name, department, email, key) {
    if (!name || !name.trim()) return { success: false, error: "Faculty name is required." };
    if (!email || !email.trim()) return { success: false, error: "Institutional email is required." };
    if (!key || key.trim().length < 4) return { success: false, error: "Access key must be at least 4 characters." };

    const facultyRecord = StorageService.saveFaculty({
      name: name.trim(),
      title: `Prof. ${name.trim()}`,
      department: department ? department.trim() : "Department of Engineering & Technology",
      email: email.trim().toLowerCase(),
      key: key.trim()
    });

    return { success: true, faculty: facultyRecord };
  },

  /**
   * Login as Student with credentials validation
   */
  async loginAsStudent(studentId, passcode, newStudentData = null) {
    let student = null;

    if (newStudentData) {
      const regRes = this.registerStudent(
        newStudentData.name,
        newStudentData.rollNumber,
        newStudentData.email,
        passcode
      );
      if (!regRes.success) return { success: false, error: regRes.error };
      student = regRes.student;
    } else {
      const validation = this.validateStudentLogin(studentId, passcode);
      if (!validation.valid) {
        return { success: false, error: validation.error, noAccounts: validation.noAccounts };
      }
      student = validation.student;
    }

    let firebaseUserUid = null;

    // Firebase Authentication connection
    if (typeof FirebaseService !== "undefined" && FirebaseService.isLive() && firebaseAuth) {
      try {
        const userCred = await firebaseAuth.signInWithEmailAndPassword(student.email, passcode);
        firebaseUserUid = userCred.user.uid;
      } catch (err) {
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
          try {
            const newCred = await firebaseAuth.createUserWithEmailAndPassword(student.email, passcode);
            firebaseUserUid = newCred.user.uid;
            if (firestoreDb) {
              await firestoreDb.collection("users").doc(firebaseUserUid).set({
                id: student.id,
                name: student.name,
                email: student.email,
                rollNumber: student.rollNumber,
                role: "student",
                createdAt: new Date().toISOString()
              }, { merge: true });
            }
          } catch (createErr) {
            console.warn("Firebase Auth registration notice:", createErr.message);
          }
        }
      }
    }

    this.currentSession = {
      role: "student",
      studentId: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      email: student.email,
      firebaseUid: firebaseUserUid,
      loggedInAt: new Date().toISOString()
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.currentSession));
    window.dispatchEvent(new CustomEvent("authStateChanged", { detail: { session: this.currentSession } }));
    return { success: true, session: this.currentSession };
  },

  /**
   * Login as Faculty with credentials validation
   */
  async loginAsFaculty(email, key, newFacultyData = null) {
    let faculty = StorageService.getFaculty();

    if (!faculty && newFacultyData) {
      const regRes = this.registerFaculty(
        newFacultyData.name || "Instructor",
        newFacultyData.department || "Engineering",
        email,
        key
      );
      if (!regRes.success) return { success: false, error: regRes.error };
      faculty = regRes.faculty;
    } else if (!faculty) {
      // First-time faculty auto-enrollment with provided credentials
      faculty = StorageService.saveFaculty({
        name: email.split("@")[0].replace(".", " "),
        title: "Prof. " + email.split("@")[0].replace(".", " "),
        department: "Department of Engineering & Technology",
        email: email.trim().toLowerCase(),
        key: key.trim()
      });
    } else {
      const validation = this.validateFacultyLogin(email, key);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }

    let firebaseUserUid = null;

    // Firebase Authentication connection
    if (typeof FirebaseService !== "undefined" && FirebaseService.isLive() && firebaseAuth) {
      try {
        const userCred = await firebaseAuth.signInWithEmailAndPassword(email, key);
        firebaseUserUid = userCred.user.uid;
      } catch (err) {
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
          try {
            const newCred = await firebaseAuth.createUserWithEmailAndPassword(email, key);
            firebaseUserUid = newCred.user.uid;
            if (firestoreDb) {
              await firestoreDb.collection("users").doc(firebaseUserUid).set({
                id: faculty.id,
                name: faculty.name,
                title: faculty.title,
                email: faculty.email,
                department: faculty.department,
                role: "faculty",
                createdAt: new Date().toISOString()
              }, { merge: true });
            }
          } catch (createErr) {
            console.warn("Firebase Auth faculty registration notice:", createErr.message);
          }
        }
      }
    }

    this.currentSession = {
      role: "faculty",
      userId: faculty.id,
      name: faculty.name,
      title: faculty.title || `Prof. ${faculty.name}`,
      email: faculty.email,
      department: faculty.department,
      firebaseUid: firebaseUserUid,
      loggedInAt: new Date().toISOString()
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.currentSession));
    window.dispatchEvent(new CustomEvent("authStateChanged", { detail: { session: this.currentSession } }));
    return { success: true, session: this.currentSession };
  },

  /**
   * Sign out and clear active session
   */
  async logout() {
    if (typeof firebaseAuth !== "undefined" && firebaseAuth) {
      try {
        await firebaseAuth.signOut();
      } catch (e) {
        // ignore
      }
    }

    this.currentSession = null;
    localStorage.removeItem(SESSION_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("authStateChanged", { detail: { session: null } }));
  },

  /**
   * Route Guard: Verifies whether the user is authorized to access a given URL route
   */
  checkRouteAccess(route) {
    const cleanRoute = (route || "#welcome").toLowerCase().split("?")[0].trim();
    const isAuth = this.isAuthenticated();
    const role = this.getRole();

    // 1. Public Welcome Page
    if (cleanRoute === "#welcome" || cleanRoute === "" || cleanRoute === "#") {
      return { allowed: true };
    }

    // 2. Student Login Page
    if (cleanRoute === "#student-login") {
      if (isAuth && role === "student") {
        return {
          allowed: false,
          redirect: "#student-dashboard",
          message: "ℹ️ Student session is already active. Redirected to dashboard."
        };
      }
      return { allowed: true };
    }

    // 3. Faculty Login Page
    if (cleanRoute === "#faculty-login") {
      if (isAuth && role === "faculty") {
        return {
          allowed: false,
          redirect: "#faculty-dashboard",
          message: "ℹ️ Faculty session is already active. Redirected to dashboard."
        };
      }
      return { allowed: true };
    }

    // 4. Protected Routes Check for Unauthenticated Users
    if (!isAuth) {
      let redirect = "#welcome";
      if (cleanRoute.includes("faculty")) redirect = "#faculty-login";
      else if (cleanRoute.includes("student")) redirect = "#student-login";

      return {
        allowed: false,
        redirect: redirect,
        message: "🔒 Authentication Required: Please sign in with your role credentials to access this page."
      };
    }

    // 5. Faculty-only routes
    if (cleanRoute === "#faculty-dashboard" || cleanRoute.includes("faculty")) {
      if (role !== "faculty") {
        return {
          allowed: false,
          redirect: "#student-dashboard",
          message: "⛔ Access Denied: Faculty authorization required. You cannot view instructor pages as a student."
        };
      }
      return { allowed: true };
    }

    // 6. Student-only routes
    if (cleanRoute === "#student-dashboard" || cleanRoute.includes("student")) {
      if (role !== "student") {
        return {
          allowed: false,
          redirect: "#faculty-dashboard",
          message: "🔒 Faculty Account Active: Student submission pages are restricted. Redirected to Faculty Dashboard."
        };
      }
      return { allowed: true };
    }

    return { allowed: true };
  }
};
