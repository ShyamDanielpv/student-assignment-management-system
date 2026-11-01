/**
 * STORAGE.JS - Production Storage Management Layer
 * Handles persistence for courses, academic activities, registered students, faculty,
 * assignments, submissions, and student evaluation feedback records.
 * Clean state: Starts with no demo data, empty student/faculty rosters, and zero assignments.
 */

const STORAGE_KEYS = {
  ASSIGNMENTS: "sams_assignments_prod",
  SUBMISSIONS: "sams_submissions_prod",
  SUBJECTS: "sams_subjects_prod",
  ACTIVITIES: "sams_activities_prod",
  STUDENTS: "sams_students_prod",
  FACULTY: "sams_faculty_prod"
};

// Legacy demo keys to systematically purge
const LEGACY_DEMO_KEYS = [
  "sams_academic_assignments_v3",
  "sams_academic_submissions_v3",
  "sams_academic_subjects_v3",
  "sams_academic_activities_v3",
  "sams_academic_students_v3",
  "sams_academic_faculty_v3",
  "sams_active_session_v4",
  "sams_assignments",
  "sams_submissions",
  "sams_students",
  "sams_faculty",
  "sams_users"
];

const StorageService = {
  /**
   * Initializes storage with clean production state.
   * Purges all legacy demo keys and establishes real curriculum structure.
   */
  init() {
    this.purgeLegacyDemoStorage();

    // Initialize course subjects catalog if not set
    if (!localStorage.getItem(STORAGE_KEYS.SUBJECTS)) {
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(SEED_DATA.courseSubjects));
    }
    // Initialize academic activities catalog if not set
    if (!localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) {
      localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(SEED_DATA.otherAcademicActivities));
    }

    // Initialize empty collections for production
    if (!localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS)) {
      localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
    }

    // Attach real-time Firestore listeners if live Firebase is active
    this.initLiveFirestoreListeners();
  },

  /**
   * Purges all demo, testing, sample, and legacy mock data from:
   * - LocalStorage
   * - SessionStorage
   * - IndexedDB
   */
  purgeLegacyDemoStorage() {
    try {
      // 1. Purge LocalStorage demo keys
      LEGACY_DEMO_KEYS.forEach((k) => localStorage.removeItem(k));

      // 2. Clear SessionStorage demo session
      sessionStorage.clear();

      // 3. Purge IndexedDB test databases if supported
      if (typeof window !== "undefined" && window.indexedDB && window.indexedDB.databases) {
        window.indexedDB.databases().then((databases) => {
          databases.forEach((dbInfo) => {
            if (dbInfo.name && (dbInfo.name.includes("demo") || dbInfo.name.includes("test") || dbInfo.name.includes("sams_mock"))) {
              window.indexedDB.deleteDatabase(dbInfo.name);
            }
          });
        }).catch(() => {
          // Ignore unsupported browser environments
        });
      }
    } catch (e) {
      console.warn("Storage cleanup notice:", e);
    }
  },

  /**
   * Real-time Cloud Firestore synchronization listeners
   * Synchronizes assignments and submissions across real devices
   */
  initLiveFirestoreListeners() {
    if (typeof FirebaseService === "undefined" || !FirebaseService.isLive() || !firestoreDb) {
      return;
    }

    try {
      // 1. Assignments Real-Time Listener
      firestoreDb.collection("assignments").onSnapshot((snapshot) => {
        const cloudList = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          cloudList.push({ ...data, id: doc.id });
        });
        localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(cloudList));
        window.dispatchEvent(new CustomEvent("samsDataUpdated", { detail: { collection: "assignments" } }));
      }, (err) => {
        console.warn("Firestore assignments listener notice:", err.message);
      });

      // 2. Submissions Real-Time Listener
      firestoreDb.collection("submissions").onSnapshot((snapshot) => {
        const cloudSubs = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          cloudSubs.push({ ...data, id: doc.id });
        });
        localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(cloudSubs));
        window.dispatchEvent(new CustomEvent("samsDataUpdated", { detail: { collection: "submissions" } }));
      }, (err) => {
        console.warn("Firestore submissions listener notice:", err.message);
      });

      // 3. Registered Users Listener (Firestore /users/)
      firestoreDb.collection("users").onSnapshot((snapshot) => {
        const cloudStudents = [];
        let facultyRecord = null;
        snapshot.forEach((doc) => {
          const user = doc.data();
          if (user.role === "student") {
            cloudStudents.push({ ...user, id: doc.id });
          } else if (user.role === "faculty" && !facultyRecord) {
            facultyRecord = { ...user, id: doc.id };
          }
        });
        if (cloudStudents.length > 0) {
          localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(cloudStudents));
        }
        if (facultyRecord) {
          localStorage.setItem(STORAGE_KEYS.FACULTY, JSON.stringify(facultyRecord));
        }
      }, (err) => {
        console.warn("Firestore users listener notice:", err.message);
      });
    } catch (e) {
      console.warn("Could not attach real-time Firestore listeners:", e);
    }
  },

  /**
   * Returns accredited course subjects (12 courses)
   */
  getCourseSubjects() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBJECTS)) || SEED_DATA.courseSubjects;
  },

  /**
   * Returns total count of regular course subjects
   */
  getCourseSubjectCount() {
    return this.getCourseSubjects().length;
  },

  /**
   * Returns Other Academic Activities (7 sessions)
   */
  getOtherAcademicActivities() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) || SEED_DATA.otherAcademicActivities;
  },

  /**
   * Returns all registered students (empty in clean production state until registered)
   */
  getStudents() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS)) || [];
  },

  /**
   * Get student by ID
   */
  getStudentById(id) {
    const students = this.getStudents();
    return students.find((s) => s.id === id) || null;
  },

  /**
   * Save / register a real student account
   */
  saveStudent(studentData) {
    const students = this.getStudents();
    const existingIndex = students.findIndex((s) => s.id === studentData.id || s.email === studentData.email);

    const record = {
      id: studentData.id || "stu_" + Date.now(),
      name: studentData.name.trim(),
      rollNumber: studentData.rollNumber ? studentData.rollNumber.trim() : `ENG-${Math.floor(100 + Math.random() * 900)}`,
      email: studentData.email ? studentData.email.trim().toLowerCase() : "",
      createdAt: studentData.createdAt || new Date().toISOString()
    };

    if (existingIndex >= 0) {
      students[existingIndex] = { ...students[existingIndex], ...record };
    } else {
      students.push(record);
    }

    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    return record;
  },

  /**
   * Returns faculty profile (null in clean production state until registered)
   */
  getFaculty() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.FACULTY)) || null;
  },

  /**
   * Save / register real faculty profile
   */
  saveFaculty(facultyData) {
    const record = {
      id: facultyData.id || "fac_" + Date.now(),
      name: facultyData.name.trim(),
      title: facultyData.title ? facultyData.title.trim() : `Prof. ${facultyData.name.trim()}`,
      role: "faculty",
      department: facultyData.department ? facultyData.department.trim() : "Department of Engineering & Technology",
      email: facultyData.email.trim().toLowerCase(),
      createdAt: facultyData.createdAt || new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEYS.FACULTY, JSON.stringify(record));
    return record;
  },

  /**
   * Returns list of faculty members for dropdown filters
   */
  getFacultyList() {
    const f = this.getFaculty();
    if (!f) return [];
    if (Array.isArray(f)) return f;
    return [{ id: f.id, name: f.name, title: f.title || `Prof. ${f.name}` }];
  },

  /**
   * Returns all assignments (empty in clean production state)
   */
  getAssignments() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS)) || [];
  },

  /**
   * Returns an assignment by ID
   */
  getAssignmentById(id) {
    const list = this.getAssignments();
    return list.find((a) => a.id === id) || null;
  },

  /**
   * Returns only assignments assigned to a specific student (or broadcast to 'all')
   */
  getAssignmentsForStudent(studentId) {
    const list = this.getAssignments();
    return list.filter((a) => a.assignedStudentId === "all" || a.assignedStudentId === studentId);
  },

  /**
   * Save a new or edited assignment
   */
  saveAssignment(data) {
    const assignments = this.getAssignments();
    const existingIndex = assignments.findIndex((a) => a.id === data.id);

    const record = {
      id: data.id || "asg_" + Date.now(),
      assignmentNumber: data.assignmentNumber || "Assignment 1",
      title: data.title,
      subjectId: data.subjectId,
      subjectTitle: data.subjectTitle,
      facultyName: data.facultyName || "Instructor",
      assignedStudentId: data.assignedStudentId || "all",
      assignedStudentName: data.assignedStudentName || "All Students",
      instructions: data.instructions,
      dueDate: data.dueDate,
      maxMarks: Number(data.maxMarks) || 100,
      assignmentFile: data.assignmentFile || "assignment_brief.pdf",
      createdAt: data.createdAt || new Date().toISOString()
    };

    if (existingIndex >= 0) {
      assignments[existingIndex] = { ...assignments[existingIndex], ...record };
    } else {
      assignments.unshift(record);
    }

    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));

    // Dispatch to Cloud Firestore if live
    if (typeof FirebaseService !== "undefined" && FirebaseService.isLive() && firestoreDb) {
      firestoreDb.collection("assignments").doc(record.id).set(record).catch((err) => {
        console.warn("Firestore saveAssignment notice:", err.message);
      });
    }

    return record;
  },

  /**
   * Delete an assignment and related submissions
   */
  deleteAssignment(id) {
    let assignments = this.getAssignments();
    assignments = assignments.filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));

    let submissions = this.getSubmissions();
    submissions = submissions.filter((s) => s.assignmentId !== id);
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));

    // Delete from Cloud Firestore if live
    if (typeof FirebaseService !== "undefined" && FirebaseService.isLive() && firestoreDb) {
      firestoreDb.collection("assignments").doc(id).delete().catch((err) => {
        console.warn("Firestore deleteAssignment notice:", err.message);
      });
    }

    return true;
  },

  /**
   * Returns all submissions (empty in clean production state)
   */
  getSubmissions() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS)) || [];
  },

  /**
   * Get submissions for an assignment
   */
  getSubmissionsByAssignmentId(asgId) {
    const submissions = this.getSubmissions();
    return submissions.filter((s) => s.assignmentId === asgId);
  },

  /**
   * Get submission for an assignment and student
   */
  getStudentSubmission(asgId, studentId) {
    const submissions = this.getSubmissions();
    return submissions.find((s) => s.assignmentId === asgId && s.studentId === studentId) || null;
  },

  /**
   * Submit student's completed assignment
   */
  submitAssignment(data) {
    const submissions = this.getSubmissions();
    const asg = this.getAssignmentById(data.assignmentId);
    const existingIndex = submissions.findIndex(
      (s) => s.assignmentId === data.assignmentId && s.studentId === data.studentId
    );

    const isPastDue = asg && new Date(asg.dueDate).getTime() < Date.now();
    const defaultStatus = isPastDue ? "Late" : "Submitted";

    const record = {
      id: existingIndex >= 0 ? submissions[existingIndex].id : "sub_" + Date.now(),
      assignmentId: data.assignmentId,
      studentId: data.studentId,
      studentName: data.studentName,
      studentRoll: data.studentRoll,
      assignmentNumber: asg ? asg.assignmentNumber : "Assignment",
      subjectTitle: asg ? asg.subjectTitle : "Course",
      submittedAt: new Date().toISOString(),
      content: data.content,
      attachmentName: data.attachmentName || "completed_assignment.pdf",
      status: defaultStatus,
      grade: existingIndex >= 0 ? submissions[existingIndex].grade : null,
      facultyFeedback: existingIndex >= 0 ? submissions[existingIndex].facultyFeedback : "",
      gradedBy: asg ? asg.facultyName || "Instructor" : "Instructor"
    };

    if (existingIndex >= 0) {
      submissions[existingIndex] = record;
    } else {
      submissions.push(record);
    }

    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));

    // Dispatch to Cloud Firestore if live
    if (typeof FirebaseService !== "undefined" && FirebaseService.isLive() && firestoreDb) {
      firestoreDb.collection("submissions").doc(record.id).set(record).catch((err) => {
        console.warn("Firestore submitAssignment notice:", err.message);
      });
    }

    return record;
  },

  /**
   * Update submission review (marks, feedback, status)
   */
  updateSubmissionReview(submissionId, marks, feedback, status = "Reviewed", facultyName = "Instructor") {
    const submissions = this.getSubmissions();
    const sub = submissions.find((s) => s.id === submissionId);
    if (!sub) return false;

    sub.grade = marks !== "" && marks !== null ? Number(marks) : null;
    sub.facultyFeedback = (feedback || "").trim();
    sub.status = status;
    sub.gradedBy = facultyName;
    sub.reviewedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));

    // Update in Cloud Firestore if live
    if (typeof FirebaseService !== "undefined" && FirebaseService.isLive() && firestoreDb) {
      firestoreDb.collection("submissions").doc(submissionId).update({
        grade: sub.grade,
        facultyFeedback: sub.facultyFeedback,
        status: sub.status,
        gradedBy: sub.gradedBy,
        reviewedAt: sub.reviewedAt
      }).catch((err) => {
        console.warn("Firestore updateSubmissionReview notice:", err.message);
      });
    }

    return true;
  },

  /**
   * Compiles evaluated feedback and marks for a specific student
   */
  getStudentFeedbackRecords(studentId) {
    const myAssignments = this.getAssignmentsForStudent(studentId);
    const submissions = this.getSubmissions();
    const records = [];

    myAssignments.forEach((asg) => {
      const sub = submissions.find((s) => s.assignmentId === asg.id && s.studentId === studentId);
      const isPastDue = new Date(asg.dueDate).getTime() < Date.now();

      let currentStatus = "Pending";
      if (sub) {
        currentStatus = sub.status;
      } else if (isPastDue) {
        currentStatus = "Late";
      }

      records.push({
        assignmentId: asg.id,
        assignmentNumber: asg.assignmentNumber,
        assignmentTitle: asg.title,
        subjectTitle: asg.subjectTitle,
        facultyName: asg.facultyName || "Instructor",
        dueDate: asg.dueDate,
        maxMarks: asg.maxMarks,
        isSubmitted: !!sub,
        submittedAt: sub ? sub.submittedAt : null,
        attachmentName: sub ? sub.attachmentName : null,
        studentContent: sub ? sub.content : null,
        status: currentStatus,
        grade: sub && sub.grade !== null && sub.grade !== undefined ? sub.grade : null,
        percentage: sub && sub.grade !== null ? Math.round((sub.grade / asg.maxMarks) * 100) : null,
        facultyFeedback: sub ? sub.facultyFeedback : "",
        reviewedAt: sub ? sub.reviewedAt : null
      });
    });

    return records;
  },

  /**
   * Compiles Student Academic Performance Summary metrics
   */
  getStudentAcademicSummary(studentId) {
    const records = this.getStudentFeedbackRecords(studentId);
    const evaluated = records.filter((r) => r.grade !== null);

    const totalAssigned = records.length;
    const submittedCount = records.filter((r) => r.isSubmitted).length;
    const pendingCount = records.filter((r) => !r.isSubmitted).length;
    const reviewedCount = evaluated.length;

    let averagePercentage = 0;
    let highestScore = 0;

    if (evaluated.length > 0) {
      const totalPct = evaluated.reduce((sum, r) => sum + r.percentage, 0);
      averagePercentage = Math.round(totalPct / evaluated.length);
      highestScore = Math.max(...evaluated.map((r) => r.grade));
    }

    return {
      totalAssigned,
      submittedCount,
      pendingCount,
      reviewedCount,
      averagePercentage,
      highestScore
    };
  },

  /**
   * Generates records for the Student Directory view
   */
  getStudentDirectoryRecords() {
    const students = this.getStudents();
    const assignments = this.getAssignments();
    const submissions = this.getSubmissions();
    const records = [];

    students.forEach((student) => {
      const studentAssignments = assignments.filter(
        (a) => a.assignedStudentId === "all" || a.assignedStudentId === student.id
      );

      if (studentAssignments.length === 0) {
        records.push({
          studentName: student.name,
          studentRoll: student.rollNumber,
          subject: "None Assigned",
          assignmentNumber: "—",
          assignmentTitle: "No Active Tasks",
          status: "Pending",
          marks: "—",
          maxMarks: "—",
          facultyName: "Faculty"
        });
      } else {
        studentAssignments.forEach((asg) => {
          const sub = submissions.find((s) => s.assignmentId === asg.id && s.studentId === student.id);
          let displayStatus = "Pending";
          let marks = "—";

          if (sub) {
            displayStatus = sub.status || "Submitted";
            marks = sub.grade !== null && sub.grade !== undefined ? `${sub.grade} / ${asg.maxMarks}` : "Awaiting Review";
          } else if (new Date(asg.dueDate).getTime() < Date.now()) {
            displayStatus = "Late";
          }

          records.push({
            studentName: student.name,
            studentRoll: student.rollNumber,
            subject: asg.subjectTitle,
            assignmentNumber: asg.assignmentNumber,
            assignmentTitle: asg.title,
            status: displayStatus,
            marks: marks,
            maxMarks: asg.maxMarks,
            facultyName: asg.facultyName || "Faculty"
          });
        });
      }
    });

    return records;
  },

  /**
   * Reset data to pristine production clean state
   */
  resetToCleanState() {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    this.purgeLegacyDemoStorage();
    this.init();
  }
};
