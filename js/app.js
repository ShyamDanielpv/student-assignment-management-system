/**
 * APP.JS - Main Application & Multi-Page Router Controller
 * Manages Animated Liquid Tab Switcher, Route Guarding, Firebase session routing,
 * Faculty submission evaluation controls (Upload, Review, Mark Completed, Add Feedback),
 * and Student assignment upload and feedback views.
 */

const App = {
  currentRoleTab: "student", // 'student' | 'faculty' (Welcome page primary tabs)
  currentDashboardTab: "assignmentsTab", // 'assignmentsTab' | 'feedbackTab' | 'evaluationsTab' | 'subjectsTab' | 'directoryTab'

  filters: {
    searchQuery: "",
    subjectId: "all",
    facultyName: "all",
    status: "all"
  },

  directoryFilters: {
    searchQuery: "",
    status: "all"
  },

  // Faculty Document Scanner State
  scannerMediaStream: null,
  scannedDocument: null,
  activeScannedAttachment: null,
  scannerTarget: "standalone",
  scannerFacingMode: "environment",

  // Progressive Web App State
  deferredPWAInstallPrompt: null,
  studentSelectedAttachment: null,

  /**
   * Initializes application on DOM load
   */
  init() {
    StorageService.init();
    AuthService.init();

    this.registerServiceWorker();
    this.initPWAInstallPrompt();
    this.initNetworkDetection();

    this.initPrimaryTabs();
    this.populateStudentLoginOptions();
    const welcomeStudentCount = document.getElementById("welcomeStudentCount");
    if (welcomeStudentCount) welcomeStudentCount.textContent = StorageService.getStudents().length;
    this.initScanner();
    this.bindEvents();
    this.updateFirebaseBadges();

    // Initialize hash routing with role guarding
    window.addEventListener("hashchange", () => this.handleHashRouting());
    this.handleHashRouting();
  },

  /**
   * PWA 1: Service Worker Registration
   */
  registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("./sw.js")
          .then((reg) => {
            console.log("✅ SAMS Service Worker registered with scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("⚠️ Service Worker registration note:", err.message);
          });
      });
    }
  },

  /**
   * PWA 2: In-App Install Prompt Handling
   */
  initPWAInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredPWAInstallPrompt = e;

      // Show install banner if not previously dismissed
      const banner = document.getElementById("pwaInstallBanner");
      if (banner && !sessionStorage.getItem("sams_pwa_dismissed")) {
        banner.style.display = "flex";
      }

      // Show install buttons in navbars
      const welcomeBtn = document.getElementById("pwaWelcomeInstallBtn");
      if (welcomeBtn) welcomeBtn.style.display = "inline-flex";
      const appBtn = document.getElementById("pwaAppInstallBtn");
      if (appBtn) appBtn.style.display = "inline-flex";
    });

    window.addEventListener("appinstalled", () => {
      this.deferredPWAInstallPrompt = null;
      const banner = document.getElementById("pwaInstallBanner");
      if (banner) banner.style.display = "none";
      UI.showToast("🎉 SAMS Mobile App installed to your device successfully!", "success");
    });
  },

  /**
   * Trigger native PWA install prompt or show instructions for iOS
   */
  async installPWA() {
    if (this.deferredPWAInstallPrompt) {
      this.deferredPWAInstallPrompt.prompt();
      const { outcome } = await this.deferredPWAInstallPrompt.userChoice;
      if (outcome === "accepted") {
        UI.showToast("Installing SAMS Mobile App...", "info");
      }
      this.deferredPWAInstallPrompt = null;
      const banner = document.getElementById("pwaInstallBanner");
      if (banner) banner.style.display = "none";
    } else {
      // Browser instructions (especially iOS Safari which requires manual 'Add to Home Screen')
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        alert("📲 To install SAMS on your iPhone/iPad:\n\n1. Tap the Share button (square with arrow up) at the bottom of Safari.\n2. Scroll down and tap 'Add to Home Screen'.\n3. Tap 'Add' in the top-right corner.");
      } else {
        alert("📲 To install SAMS on your device:\n\n1. Open your browser menu (three dots in top right or bottom).\n2. Tap 'Install app' or 'Add to Home Screen'.");
      }
    }
  },

  /**
   * Dismiss the PWA installation banner for the current session
   */
  dismissPWAInstall() {
    const banner = document.getElementById("pwaInstallBanner");
    if (banner) banner.style.display = "none";
    sessionStorage.setItem("sams_pwa_dismissed", "true");
  },

  /**
   * PWA 3: Online / Offline Status Detection
   */
  initNetworkDetection() {
    const updateStatus = () => {
      const banner = document.getElementById("offlineIndicator");
      if (banner) {
        banner.style.display = navigator.onLine ? "none" : "flex";
      }
      if (!navigator.onLine) {
        UI.showToast("📡 Offline Mode: Working from offline cache.", "warning");
      } else {
        UI.showToast("🌐 Network reconnected.", "success");
      }
    };

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    if (!navigator.onLine) {
      const banner = document.getElementById("offlineIndicator");
      if (banner) banner.style.display = "flex";
    }
  },

  /**
   * Interactive Liquid-Style Animated Tab Switcher (Student & Faculty)
   */
  initPrimaryTabs() {
    this.currentRoleTab = "student";

    const tabStudent = document.getElementById("primaryTabStudent");
    const tabFaculty = document.getElementById("primaryTabFaculty");
    const tablist = document.getElementById("primaryRoleTablist");

    if (!tabStudent || !tabFaculty || !tablist) return;

    // Switch to Student tab
    tabStudent.addEventListener("click", () => this.switchPrimaryRoleTab("student"));
    // Switch to Faculty tab
    tabFaculty.addEventListener("click", () => this.switchPrimaryRoleTab("faculty"));

    // Keyboard navigation (Arrow keys, Home, End, Space, Enter)
    tablist.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        this.switchPrimaryRoleTab("faculty");
        tabFaculty.focus();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        this.switchPrimaryRoleTab("student");
        tabStudent.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        this.switchPrimaryRoleTab("student");
        tabStudent.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        this.switchPrimaryRoleTab("faculty");
        tabFaculty.focus();
      }
    });

    // Resize listener ensures the sliding pill stays aligned without layout shifts
    window.addEventListener("resize", () => {
      this.updateTabSliderPill(this.currentRoleTab, false);
    });

    // Initial pill position
    requestAnimationFrame(() => {
      this.updateTabSliderPill("student", false);
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        this.updateTabSliderPill(this.currentRoleTab || "student", false);
      });
    }
  },

  /**
   * Switch the primary role tab (Student vs. Faculty) with liquid sliding animation
   */
  switchPrimaryRoleTab(role) {
    if (this.currentRoleTab === role) return;
    this.currentRoleTab = role;

    const tabStudent = document.getElementById("primaryTabStudent");
    const tabFaculty = document.getElementById("primaryTabFaculty");
    const panelStudent = document.getElementById("portalStudentPanel");
    const panelFaculty = document.getElementById("portalFacultyPanel");

    const isStudent = role === "student";

    if (tabStudent && tabFaculty) {
      tabStudent.classList.toggle("active", isStudent);
      tabStudent.setAttribute("aria-selected", isStudent ? "true" : "false");
      tabStudent.setAttribute("tabindex", isStudent ? "0" : "-1");

      tabFaculty.classList.toggle("active", !isStudent);
      tabFaculty.setAttribute("aria-selected", !isStudent ? "true" : "false");
      tabFaculty.setAttribute("tabindex", !isStudent ? "0" : "-1");
    }

    // Move the liquid slider pill
    this.updateTabSliderPill(role, true);

    const incomingPanel = isStudent ? panelStudent : panelFaculty;
    const outgoingPanel = isStudent ? panelFaculty : panelStudent;

    if (incomingPanel && outgoingPanel) {
      // 1. Immediately deactivate outgoing panel
      outgoingPanel.classList.remove("tab-panel-active", "tab-panel-visible");
      outgoingPanel.style.display = "";

      // 2. Prepare incoming panel for entrance animation
      incomingPanel.classList.remove("tab-panel-active");
      incomingPanel.classList.add("tab-panel-visible");
      incomingPanel.style.display = "";

      // 3. Force browser reflow to reset initial translation and opacity
      void incomingPanel.offsetWidth;

      // 4. Animate to active state (fade in + slide up over 380ms)
      const activate = () => {
        incomingPanel.classList.add("tab-panel-active");
      };
      if (typeof window.requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
          requestAnimationFrame(activate);
        });
      }
      setTimeout(activate, 25);
    }
  },

  /**
   * Computes exact geometry and glides the liquid sliding pill
   */
  updateTabSliderPill(role, animate = true) {
    const pill = document.getElementById("primaryTabPill");
    const targetTab = document.getElementById(role === "student" ? "primaryTabStudent" : "primaryTabFaculty");

    if (!pill || !targetTab) return;

    const leftOffset = targetTab.offsetLeft;
    const width = targetTab.offsetWidth;

    pill.style.transition = animate
      ? "transform 380ms cubic-bezier(0.25, 1, 0.5, 1), width 380ms cubic-bezier(0.25, 1, 0.5, 1), background 380ms ease, box-shadow 380ms ease"
      : "none";

    pill.style.width = `${width}px`;
    pill.style.transform = `translateX(${leftOffset}px)`;
    pill.classList.toggle("faculty-active", role === "faculty");
  },

  /**
   * Navigate using URL hash with Route Guard protection
   */
  navigateTo(hash) {
    window.location.hash = hash;
  },

  /**
   * Router and Route Guard: Prevents cross-role access (e.g. typing #faculty-dashboard as student)
   */
  handleHashRouting() {
    let hash = window.location.hash || "#welcome";
    const accessCheck = AuthService.checkRouteAccess(hash);

    if (!accessCheck.allowed) {
      if (accessCheck.message) {
        const isError = accessCheck.message.includes("⛔") || accessCheck.message.includes("Denied") || accessCheck.message.includes("Required");
        UI.showToast(accessCheck.message, isError ? "danger" : "warning");
        this.showRouteGuardBanner(
          accessCheck.message, 
          isError ? "Access Denied (Role Protection)" : "Navigation Notice"
        );
      }
      window.location.hash = accessCheck.redirect;
      return;
    }

    // Show appropriate page view
    const pages = {
      "#welcome": "pageWelcome",
      "#student-login": "pageStudentLogin",
      "#faculty-login": "pageFacultyLogin",
      "#student-dashboard": "pageApp",
      "#faculty-dashboard": "pageApp"
    };

    const targetPageId = pages[hash] || (AuthService.isAuthenticated() ? "pageApp" : "pageWelcome");

    document.querySelectorAll(".page-view").forEach((p) => {
      p.style.display = p.id === targetPageId ? "block" : "none";
    });

    window.scrollTo({ top: 0, behavior: "smooth" });

    // Mobile Bottom Navigation Bar Visibility
    const mobileNav = document.getElementById("mobileBottomNav");
    if (mobileNav) {
      mobileNav.style.display = targetPageId === "pageApp" ? "flex" : "none";
    }

    if (targetPageId === "pageApp") {
      this.render();
    } else if (targetPageId === "pageWelcome") {
      this.hideRouteGuardBanner();
      requestAnimationFrame(() => {
        this.updateTabSliderPill(this.currentRoleTab || "student", false);
      });
    } else {
      this.hideRouteGuardBanner();
    }
  },

  /**
   * Display persistent dismissal banner for route guard violations
   */
  showRouteGuardBanner(message, title = "Access Denied") {
    const alertEl = document.getElementById("routeGuardAlert");
    const titleEl = document.getElementById("routeGuardAlertTitle");
    const msgEl = document.getElementById("routeGuardAlertMessage");

    if (alertEl) {
      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      alertEl.style.display = "flex";
    }
  },

  /**
   * Hide route guard violation banner
   */
  hideRouteGuardBanner() {
    const alertEl = document.getElementById("routeGuardAlert");
    if (alertEl) alertEl.style.display = "none";
  },

  /**
   * Display inline authentication error on login cards
   */
  showAuthError(containerId, inputElement, message) {
    const banner = document.getElementById(containerId);
    if (banner) {
      banner.innerHTML = `<span style="font-size: 1.15rem; line-height: 1;">⚠️</span><div>${message}</div>`;
      banner.style.display = "flex";
    }
    if (inputElement) {
      inputElement.classList.add("input-error");
      inputElement.focus();
    }
  },

  /**
   * Clear inline authentication error on login cards
   */
  clearAuthError(containerId, inputElement) {
    const banner = document.getElementById(containerId);
    if (banner) {
      banner.style.display = "none";
      banner.innerHTML = "";
    }
    if (inputElement) {
      inputElement.classList.remove("input-error");
    }
  },

  /**
   * Populate Student Login profile selector
   */
  populateStudentLoginOptions() {
    const students = StorageService.getStudents();
    const select = document.getElementById("loginStudentSelect");
    const rollInput = document.getElementById("loginStudentRoll");

    if (!select) return;

    if (students.length === 0) {
      select.innerHTML = `<option value="" disabled selected>No student accounts registered yet</option>`;
      if (rollInput) rollInput.value = "";
      return;
    }

    select.innerHTML = `<option value="" disabled selected>-- Select your registered name --</option>` +
      students
        .map((s) => `<option value="${s.id}" data-roll="${s.rollNumber}">${s.name} (${s.rollNumber})</option>`)
        .join("");

    if (rollInput) {
      rollInput.value = "";
    }

    select.addEventListener("change", (e) => {
      const selectedOption = e.target.options[e.target.selectedIndex];
      if (rollInput && selectedOption) {
        rollInput.value = selectedOption.dataset.roll || "";
      }
      this.clearAuthError("studentLoginError", document.getElementById("studentPasswordInput"));
    });
  },

  /**
   * Toggle between student login and student registration form
   */
  toggleStudentRegisterForm(showRegister = true) {
    const loginForm = document.getElementById("studentLoginForm");
    const registerForm = document.getElementById("studentRegisterForm");
    if (!loginForm || !registerForm) return;

    if (showRegister) {
      loginForm.style.display = "none";
      registerForm.style.display = "block";
    } else {
      registerForm.style.display = "none";
      loginForm.style.display = "block";
    }
  },

  /**
   * Event bindings for login, logout, tabs, and form submissions
   */
  bindEvents() {
    // Auth state changed listener
    window.addEventListener("authStateChanged", (e) => {
      if (e.detail.session) {
        const dest = e.detail.session.role === "faculty" ? "#faculty-dashboard" : "#student-dashboard";
        this.navigateTo(dest);
      } else {
        this.navigateTo("#welcome");
      }
    });

    // -------------------------------------------------------------
    // STUDENT LOGIN HANDLING & VALIDATION
    // -------------------------------------------------------------
    const studentLoginForm = document.getElementById("studentLoginForm");
    const studentPassInput = document.getElementById("studentPasswordInput");
    const studentSubmitBtn = document.getElementById("studentLoginSubmitBtn");

    if (studentPassInput) {
      studentPassInput.addEventListener("input", () => {
        this.clearAuthError("studentLoginError", studentPassInput);
      });
    }

    // Toggle Student Password Visibility
    const toggleStudentBtn = document.getElementById("toggleStudentPassword");
    if (toggleStudentBtn && studentPassInput) {
      toggleStudentBtn.addEventListener("click", () => {
        const isPassword = studentPassInput.type === "password";
        studentPassInput.type = isPassword ? "text" : "password";
        toggleStudentBtn.textContent = isPassword ? "🙈" : "👁️";
      });
    }

    // Student Registration Form Submit
    const studentRegisterForm = document.getElementById("studentRegisterForm");
    const regStudentSubmitBtn = document.getElementById("regStudentSubmitBtn");
    if (studentRegisterForm) {
      studentRegisterForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("regStudentName")?.value.trim();
        const rollNumber = document.getElementById("regStudentRoll")?.value.trim();
        const email = document.getElementById("regStudentEmail")?.value.trim();
        const passcode = document.getElementById("regStudentPasscode")?.value.trim();

        if (!name || !rollNumber || !passcode) {
          UI.showToast("Please fill in student name, roll number, and passcode.", "warning");
          return;
        }

        if (regStudentSubmitBtn) {
          regStudentSubmitBtn.disabled = true;
          regStudentSubmitBtn.textContent = "Creating Account...";
        }

        const res = await AuthService.loginAsStudent(null, passcode, { name, rollNumber, email });

        if (regStudentSubmitBtn) {
          regStudentSubmitBtn.disabled = false;
          regStudentSubmitBtn.textContent = "Create & Sign In →";
        }

        if (!res.success) {
          UI.showToast(res.error, "danger");
          return;
        }

        this.populateStudentLoginOptions();
    const welcomeStudentCount = document.getElementById("welcomeStudentCount");
    if (welcomeStudentCount) welcomeStudentCount.textContent = StorageService.getStudents().length;
        this.hideRouteGuardBanner();
        UI.showToast(`✅ Welcome, ${res.session.name}! Account registered successfully.`, "success");
      });
    }

    if (studentLoginForm) {
      studentLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const select = document.getElementById("loginStudentSelect");
        const studentId = select ? select.value : "";
        const passcode = studentPassInput ? studentPassInput.value : "";

        this.clearAuthError("studentLoginError", studentPassInput);

        if (studentSubmitBtn) {
          studentSubmitBtn.disabled = true;
          studentSubmitBtn.textContent = "Verifying Student Access...";
        }

        const res = await AuthService.loginAsStudent(studentId, passcode);

        if (studentSubmitBtn) {
          studentSubmitBtn.disabled = false;
          studentSubmitBtn.textContent = "Enter Student Dashboard →";
        }

        if (!res.success) {
          this.showAuthError("studentLoginError", studentPassInput, res.error);
          UI.showToast(res.error, "danger");
          return;
        }

        if (studentPassInput) studentPassInput.value = "";
        this.hideRouteGuardBanner();
        UI.showToast(`✅ Welcome back, ${res.session.name}!`, "success");
      });
    }

    // -------------------------------------------------------------
    // FACULTY LOGIN HANDLING & VALIDATION
    // -------------------------------------------------------------
    const facultyLoginForm = document.getElementById("facultyLoginForm");
    const facultyEmailInput = document.getElementById("facultyEmailInput");
    const facultyPassInput = document.getElementById("facultyPasswordInput");
    const facultySubmitBtn = document.getElementById("facultyLoginSubmitBtn");

    if (facultyEmailInput) {
      facultyEmailInput.addEventListener("input", () => {
        this.clearAuthError("facultyLoginError", facultyEmailInput);
      });
    }
    if (facultyPassInput) {
      facultyPassInput.addEventListener("input", () => {
        this.clearAuthError("facultyLoginError", facultyPassInput);
      });
    }

    // Toggle Faculty Password Visibility
    const toggleFacultyBtn = document.getElementById("toggleFacultyPassword");
    if (toggleFacultyBtn && facultyPassInput) {
      toggleFacultyBtn.addEventListener("click", () => {
        const isPassword = facultyPassInput.type === "password";
        facultyPassInput.type = isPassword ? "text" : "password";
        toggleFacultyBtn.textContent = isPassword ? "🙈" : "👁️";
      });
    }

    if (facultyLoginForm) {
      facultyLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = facultyEmailInput ? facultyEmailInput.value : "";
        const key = facultyPassInput ? facultyPassInput.value : "";
        const name = document.getElementById("facultyNameInput")?.value || "";
        const department = document.getElementById("facultyDepartmentInput")?.value || "";

        this.clearAuthError("facultyLoginError", facultyPassInput);

        if (facultySubmitBtn) {
          facultySubmitBtn.disabled = true;
          facultySubmitBtn.textContent = "Verifying Faculty Credentials...";
        }

        const res = await AuthService.loginAsFaculty(email, key, { name, department });

        if (facultySubmitBtn) {
          facultySubmitBtn.disabled = false;
          facultySubmitBtn.textContent = "Enter Faculty Dashboard →";
        }

        if (!res.success) {
          const targetInput = res.error.toLowerCase().includes("email") ? facultyEmailInput : facultyPassInput;
          this.showAuthError("facultyLoginError", targetInput, res.error);
          UI.showToast(res.error, "danger");
          return;
        }

        if (facultyPassInput) facultyPassInput.value = "";
        this.hideRouteGuardBanner();
        UI.showToast(`✅ Welcome back, ${res.session.title || res.session.name}!`, "success");
      });
    }

    // -------------------------------------------------------------
    // LOGOUT HANDLING
    // -------------------------------------------------------------
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to log out of your session?")) {
          this.stopScannerCamera();
          await AuthService.logout();
          this.hideRouteGuardBanner();
          UI.showToast("👋 Signed out securely. Have a great day!", "info");
        }
      });
    }

    // Navigation Tabs in Dashboard
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tabId = e.currentTarget.dataset.tab;
        this.switchDashboardTab(tabId);
      });
    });

    // Assignment Form Submit (Clara - Faculty)
    const assignmentForm = document.getElementById("assignmentForm");
    if (assignmentForm) {
      assignmentForm.addEventListener("submit", (e) => this.handleAssignmentSubmit(e));
    }

    // Submission Form Submit (Student Upload)
    const submissionForm = document.getElementById("submissionForm");
    if (submissionForm) {
      submissionForm.addEventListener("submit", (e) => this.handleStudentSubmission(e));
    }

    // Grade & Status Form Submit (Clara - Faculty)
    const gradeForm = document.getElementById("gradeForm");
    if (gradeForm) {
      gradeForm.addEventListener("submit", (e) => this.handleGradeSubmit(e));
    }

    // Search input
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.filters.searchQuery = e.target.value.toLowerCase().trim();
        this.renderCards();
      });
    }

    // Filter by Subject
    const courseFilter = document.getElementById("courseFilter");
    if (courseFilter) {
      courseFilter.addEventListener("change", (e) => {
        this.filters.subjectId = e.target.value;
        this.renderCards();
      });
    }

    // Filter by Faculty
    const facultyFilter = document.getElementById("facultyFilter");
    if (facultyFilter) {
      facultyFilter.addEventListener("change", (e) => {
        this.filters.facultyName = e.target.value;
        this.renderCards();
      });
    }

    // Filter by Status
    const statusFilter = document.getElementById("statusFilter");
    if (statusFilter) {
      statusFilter.addEventListener("change", (e) => {
        this.filters.status = e.target.value;
        this.renderCards();
      });
    }

    // Directory Search & Filter
    const dirSearch = document.getElementById("directorySearchInput");
    if (dirSearch) {
      dirSearch.addEventListener("input", (e) => {
        this.directoryFilters.searchQuery = e.target.value.toLowerCase().trim();
        this.renderDirectory();
      });
    }

    const dirStatus = document.getElementById("directoryStatusFilter");
    if (dirStatus) {
      dirStatus.addEventListener("change", (e) => {
        this.directoryFilters.status = e.target.value;
        this.renderDirectory();
      });
    }

    // Firebase Cloud Configuration Form Submit
    const firebaseConfigForm = document.getElementById("firebaseConfigForm");
    if (firebaseConfigForm) {
      firebaseConfigForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const apiKey = document.getElementById("cfgApiKey")?.value.trim();
        const projectId = document.getElementById("cfgProjectId")?.value.trim();
        const storageBucket = document.getElementById("cfgStorageBucket")?.value.trim();

        const res = FirebaseService.saveConfig({ apiKey, projectId, storageBucket });
        if (res.success) {
          UI.showToast("🔥 Firebase credentials saved! Connecting to cloud...", "success");
          this.updateFirebaseBadges();
          UI.closeModal("firebaseModal");
          this.render();
        } else {
          UI.showToast(res.error, "danger");
        }
      });
    }

    // Listen for live Firebase status changes
    window.addEventListener("firebaseStatusChanged", () => {
      this.updateFirebaseBadges();
      this.render();
    });

    // Listen for cross-phone real-time Firestore updates
    window.addEventListener("samsDataUpdated", (e) => {
      console.log("🔄 Real-time Firestore sync event:", e.detail);
      this.render();
    });
  },

  /**
   * Update visual Firebase Cloud connection badges in headers
   */
  updateFirebaseBadges() {
    const isLive = typeof FirebaseService !== "undefined" && FirebaseService.isLive();
    const label = isLive ? "🔥 Cloud Live" : "⚡ Demo Mode";
    const welcomeBadge = document.getElementById("welcomeFirebaseBadge");
    const dashBadge = document.getElementById("dashboardFirebaseBadge");

    [welcomeBadge, dashBadge].forEach((b) => {
      if (b) {
        b.textContent = label;
        b.classList.toggle("live", isLive);
      }
    });
  },

  /**
   * Open Firebase Connection & Configuration Modal
   */
  openFirebaseModal() {
    const isLive = typeof FirebaseService !== "undefined" && FirebaseService.isLive();
    const cfg = typeof FirebaseService !== "undefined" ? FirebaseService.getConfig() : {};

    const card = document.getElementById("firebaseStatusCard");
    const dot = document.getElementById("firebaseStatusIndicator");
    const title = document.getElementById("firebaseStatusTitle");
    const details = document.getElementById("firebaseStatusDetails");
    const pill = document.getElementById("firebaseStatusPill");

    if (isLive) {
      if (card) card.classList.add("live");
      if (dot) dot.classList.add("live");
      if (title) title.textContent = "🟢 Firebase Live Cloud Connected";
      if (details) details.textContent = `Connected to Project ID: ${cfg.projectId} | Storage: ${cfg.storageBucket || "Active"}. Real-time synchronization is running.`;
      if (pill) {
        pill.className = "badge badge-reviewed";
        pill.textContent = "Cloud Live";
      }
    } else {
      if (card) card.classList.remove("live");
      if (dot) dot.classList.remove("live");
      if (title) title.textContent = "🟡 Local Demo Mode Active";
      if (details) details.textContent = "Running safely with sample academic data in local storage. Enter your Firebase project keys below to connect Authentication, Firestore, and Cloud Storage.";
      if (pill) {
        pill.className = "badge badge-pending";
        pill.textContent = "Local Storage";
      }
    }

    const apiKeyInput = document.getElementById("cfgApiKey");
    const projectIdInput = document.getElementById("cfgProjectId");
    const storageBucketInput = document.getElementById("cfgStorageBucket");

    if (apiKeyInput && cfg.apiKey && cfg.apiKey !== "YOUR_FIREBASE_API_KEY") apiKeyInput.value = cfg.apiKey;
    if (projectIdInput && cfg.projectId && cfg.projectId !== "your-project-id") projectIdInput.value = cfg.projectId;
    if (storageBucketInput && cfg.storageBucket && cfg.storageBucket !== "your-project-id.appspot.com") storageBucketInput.value = cfg.storageBucket;

    UI.openModal("firebaseModal");
  },

  /**
   * Revert Firebase to offline mode
   */
  resetFirebaseToDemo() {
    this.resetFirebaseToLocal();
  },

  resetFirebaseToLocal() {
    if (confirm("Reset connection back to offline local storage mode?")) {
      FirebaseService.clearConfig();
    }
  },

  /**
   * Switch active dashboard tab with role permission guards
   */
  switchDashboardTab(tabId) {
    const role = AuthService.getRole();

    // Guard: Evaluations tab is strictly Faculty-only
    if (tabId === "evaluationsTab" && role !== "faculty") {
      UI.showToast("⛔ Access Denied: Only faculty accounts can access student evaluations.", "danger");
      this.showRouteGuardBanner("Student accounts are not authorized to view the Faculty Evaluations tab.");
      return;
    }

    // Guard: Feedback tab is specifically for student's individual grades
    if (tabId === "feedbackTab" && role !== "student") {
      UI.showToast("ℹ️ Faculty members review and evaluate student coursework via the Evaluations tab.", "info");
      tabId = "evaluationsTab";
    }

    this.currentDashboardTab = tabId;

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    document.querySelectorAll(".mobile-nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.tab === tabId);
    });

    const views = {
      assignmentsTab: document.getElementById("viewAssignments"),
      feedbackTab: document.getElementById("viewFeedback"),
      evaluationsTab: document.getElementById("viewFacultyEvaluations"),
      subjectsTab: document.getElementById("viewSubjects"),
      directoryTab: document.getElementById("viewDirectory")
    };

    Object.keys(views).forEach((key) => {
      if (views[key]) {
        views[key].style.display = key === tabId ? "block" : "none";
      }
    });

    if (tabId === "feedbackTab") {
      this.renderFeedbackPage();
    } else if (tabId === "evaluationsTab") {
      this.renderEvaluationsPage();
    } else if (tabId === "subjectsTab") {
      this.renderSubjects();
      this.renderActivities();
    } else if (tabId === "directoryTab") {
      this.renderDirectory();
    }
  },

  /**
   * Main Render Method for Dashboard
   */
  render() {
    const role = AuthService.getRole();
    const user = AuthService.getCurrentUser();

    if (!role || !user) {
      this.navigateTo("#welcome");
      return;
    }

    // 1. Role-specific tab visibility
    const feedbackTabBtn = document.getElementById("tabLinkFeedback");
    const evaluationsTabBtn = document.getElementById("tabLinkEvaluations");
    const createAsgBtn = document.getElementById("createAssignmentBtn");
    const scannerBtn = document.getElementById("scannerBtn");

    // 1b. Mobile bottom navigation role visibility
    const mobileFeedbackBtn = document.getElementById("mobileNavFeedback");
    const mobileEvaluationsBtn = document.getElementById("mobileNavEvaluations");

    if (role === "faculty") {
      if (feedbackTabBtn) feedbackTabBtn.style.display = "none";
      if (evaluationsTabBtn) evaluationsTabBtn.style.display = "inline-flex";
      if (createAsgBtn) createAsgBtn.style.display = "inline-flex";
      if (scannerBtn) scannerBtn.style.display = "inline-flex";
      if (mobileFeedbackBtn) mobileFeedbackBtn.style.display = "none";
      if (mobileEvaluationsBtn) mobileEvaluationsBtn.style.display = "flex";
    } else {
      if (feedbackTabBtn) feedbackTabBtn.style.display = "inline-flex";
      if (evaluationsTabBtn) evaluationsTabBtn.style.display = "none";
      if (createAsgBtn) createAsgBtn.style.display = "none";
      if (scannerBtn) scannerBtn.style.display = "none";
      if (mobileFeedbackBtn) mobileFeedbackBtn.style.display = "flex";
      if (mobileEvaluationsBtn) mobileEvaluationsBtn.style.display = "none";
    }

    // 2. User Profile Display
    const userAvatarEl = document.getElementById("currentUserAvatar");
    const userNameEl = document.getElementById("currentUserName");
    const userRoleEl = document.getElementById("currentUserRole");
    const navSubtitle = document.getElementById("navSubtitle");

    if (role === "faculty") {
      if (userAvatarEl) userAvatarEl.textContent = "👩‍🏫";
      if (userNameEl) userNameEl.textContent = user ? (user.title || `Prof. ${user.name}`) : "Faculty Instructor";
      if (userRoleEl) userRoleEl.textContent = "Faculty Member";
      if (navSubtitle) navSubtitle.textContent = "Faculty Academic Portal";
    } else {
      if (userAvatarEl) userAvatarEl.textContent = "🎓";
      if (userNameEl) userNameEl.textContent = user.name;
      if (userRoleEl) userRoleEl.textContent = `Student (${user.rollNumber})`;
      if (navSubtitle) navSubtitle.textContent = "Student Coursework Portal";
    }

    // 3. Banner Texts
    const bannerTitle = document.getElementById("bannerTitle");
    const bannerSubtitle = document.getElementById("bannerSubtitle");

    if (role === "faculty") {
      if (bannerTitle) bannerTitle.textContent = "Faculty Assignment Dashboard";
      if (bannerSubtitle) bannerSubtitle.textContent = "Create coursework across subjects, review student submissions, and manage evaluation grading.";
    } else {
      if (bannerTitle) bannerTitle.textContent = "Student Coursework Dashboard";
      if (bannerSubtitle) bannerSubtitle.textContent = `Welcome, ${user.name}. View assigned coursework, search by subject or faculty, submit solutions, and track grades.`;
    }

    // 4. Populate Dropdowns
    this.populateSubjectOptions();
    this.populateFacultyOptions();

    // 5. Update counts and active sub-views
    this.updateTabBadges();
    this.renderStats();
    this.renderCards();
    this.renderFeedbackPage();
    this.renderEvaluationsPage();
    this.renderSubjects();
    this.renderActivities();
    this.renderDirectory();
  },

  /**
   * Update badges in navigation tabs
   */
  updateTabBadges() {
    const role = AuthService.getRole();
    const user = AuthService.getCurrentUser();
    const assignments = role === "faculty" ? StorageService.getAssignments() : (user ? StorageService.getAssignmentsForStudent(user.id) : []);
    const subjectCount = StorageService.getCourseSubjectCount();
    const directoryRecords = StorageService.getStudentDirectoryRecords();
    const submissions = StorageService.getSubmissions();

    const asgBadge = document.getElementById("tabAssignmentsBadge");
    const fbBadge = document.getElementById("tabFeedbackBadge");
    const evalBadge = document.getElementById("tabEvaluationsBadge");
    const subBadge = document.getElementById("tabSubjectsBadge");
    const dirBadge = document.getElementById("tabDirectoryBadge");

    if (asgBadge) asgBadge.textContent = assignments.length;
    if (subBadge) subBadge.textContent = subjectCount;
    if (dirBadge) dirBadge.textContent = directoryRecords.length;

    if (fbBadge && role === "student" && user) {
      const feedbackRecords = StorageService.getStudentFeedbackRecords(user.id);
      fbBadge.textContent = feedbackRecords.filter((r) => r.grade !== null).length;
    }

    if (evalBadge && role === "faculty") {
      evalBadge.textContent = submissions.length;
    }
  },

  /**
   * Populate Subject & Student options
   */
  populateSubjectOptions() {
    const subjects = StorageService.getCourseSubjects();
    const students = StorageService.getStudents();

    const courseFilter = document.getElementById("courseFilter");
    if (courseFilter) {
      const selected = courseFilter.value;
      courseFilter.innerHTML = `<option value="all">All Subjects</option>`;
      subjects.forEach((sub) => {
        courseFilter.innerHTML += `<option value="${sub.id}">${sub.code} - ${sub.title}</option>`;
      });
      courseFilter.value = selected || "all";
    }

    const formSubjectSelect = document.getElementById("formSubjectId");
    if (formSubjectSelect) {
      formSubjectSelect.innerHTML = `<option value="" disabled selected>Select Course Subject</option>`;
      subjects.forEach((sub) => {
        formSubjectSelect.innerHTML += `<option value="${sub.id}" data-title="${sub.title}">${sub.code} - ${sub.title}</option>`;
      });
    }

    const formStudentSelect = document.getElementById("formAssignedStudent");
    if (formStudentSelect) {
      formStudentSelect.innerHTML = `<option value="all" data-name="All Students">👥 All Students (Broadcast)</option>`;
      students.forEach((stu) => {
        formStudentSelect.innerHTML += `<option value="${stu.id}" data-name="${stu.name}">🎓 ${stu.name} (${stu.rollNumber})</option>`;
      });
    }
  },

  /**
   * Populate Faculty dropdown
   */
  populateFacultyOptions() {
    const facultyFilter = document.getElementById("facultyFilter");
    if (!facultyFilter) return;

    const selected = facultyFilter.value;
    const facultyList = StorageService.getFacultyList();

    facultyFilter.innerHTML = `<option value="all">All Faculty</option>`;
    facultyList.forEach((fac) => {
      facultyFilter.innerHTML += `<option value="${fac.name}">${fac.title}</option>`;
    });
    facultyFilter.value = selected || "all";
  },

  /**
   * Render Stats Grid
   */
  renderStats() {
    const role = AuthService.getRole();
    const user = AuthService.getCurrentUser();
    const statsContainer = document.getElementById("statsGrid");

    if (!statsContainer || !role || !user) return;

    const assignments = StorageService.getAssignments();
    const submissions = StorageService.getSubmissions();

    if (role === "faculty") {
      const totalAsg = assignments.length;
      const totalSub = submissions.length;
      const needReview = submissions.filter((s) => s.status === "Submitted" || s.status === "Late").length;
      const reviewedCount = submissions.filter((s) => s.status === "Reviewed").length;

      statsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon blue">📁</div>
          <div>
            <div class="stat-number">${totalAsg}</div>
            <div class="stat-label">Active Assignments</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">📥</div>
          <div>
            <div class="stat-number">${totalSub}</div>
            <div class="stat-label">Total Submissions</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon yellow">⏳</div>
          <div>
            <div class="stat-number">${needReview}</div>
            <div class="stat-label">Awaiting Evaluation</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">✅</div>
          <div>
            <div class="stat-number">${reviewedCount}</div>
            <div class="stat-label">Evaluated / Reviewed</div>
          </div>
        </div>
      `;
    } else {
      const summary = StorageService.getStudentAcademicSummary(user.id);

      statsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon blue">📚</div>
          <div>
            <div class="stat-number">${summary.totalAssigned}</div>
            <div class="stat-label">Assigned Coursework</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon yellow">⏳</div>
          <div>
            <div class="stat-number">${summary.pendingCount}</div>
            <div class="stat-label">Pending Submissions</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green">📬</div>
          <div>
            <div class="stat-number">${summary.submittedCount}</div>
            <div class="stat-label">Completed & Uploaded</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">⭐</div>
          <div>
            <div class="stat-number">${summary.reviewedCount}</div>
            <div class="stat-label">Reviewed & Graded</div>
          </div>
        </div>
      `;
    }
  },

  /**
   * Render Assignment Cards (Filtered by search, subject, faculty, and status)
   */
  renderCards() {
    const role = AuthService.getRole();
    const user = AuthService.getCurrentUser();
    const container = document.getElementById("assignmentsContainer");
    if (!container || !role || !user) return;

    let list = role === "faculty" ? StorageService.getAssignments() : StorageService.getAssignmentsForStudent(user.id);

    // Subject Filter
    if (this.filters.subjectId !== "all") {
      list = list.filter((a) => a.subjectId === this.filters.subjectId);
    }

    // Faculty Filter
    if (this.filters.facultyName !== "all") {
      list = list.filter(
        (a) => (a.facultyName || "Faculty").toLowerCase() === this.filters.facultyName.toLowerCase()
      );
    }

    // Search Filter
    if (this.filters.searchQuery) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(this.filters.searchQuery) ||
          a.subjectTitle.toLowerCase().includes(this.filters.searchQuery) ||
          (a.facultyName && a.facultyName.toLowerCase().includes(this.filters.searchQuery)) ||
          (a.assignedStudentName && a.assignedStudentName.toLowerCase().includes(this.filters.searchQuery)) ||
          a.assignmentNumber.toLowerCase().includes(this.filters.searchQuery)
      );
    }

    // Status Filter
    if (this.filters.status !== "all") {
      list = list.filter((a) => {
        if (role === "student") {
          const sub = StorageService.getStudentSubmission(a.id, user.id);
          const currentStatus = sub ? sub.status : UI.isOverdue(a.dueDate) ? "Late" : "Pending";
          return currentStatus.toLowerCase() === this.filters.status.toLowerCase();
        } else {
          const subs = StorageService.getSubmissionsByAssignmentId(a.id);
          if (this.filters.status === "Pending") return subs.length === 0;
          return subs.some((s) => s.status.toLowerCase() === this.filters.status.toLowerCase());
        }
      });
    }

    if (list.length === 0) {
      const isFiltered = this.filters.subjectId !== "all" || this.filters.facultyName !== "all" || this.filters.status !== "all" || !!this.filters.searchQuery;

      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h3 class="empty-state-title">${isFiltered ? "No assignments match your criteria" : "No assignments available yet"}</h3>
          <p class="empty-state-text">
            ${
              role === "faculty"
                ? (isFiltered ? "No active assignments match your filters. Try selecting 'All Subjects'." : "Click 'Create Assignment' above to publish coursework for students.")
                : (isFiltered ? "No active assignments match your search or filter options. Try selecting 'All Subjects' or clearing your search." : "Your faculty instructor has not assigned any coursework at this time.")
            }
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = list
      .map((asg) => {
        const subs = StorageService.getSubmissionsByAssignmentId(asg.id);
        const mySub = role === "student" ? StorageService.getStudentSubmission(asg.id, user.id) : null;
        const isPastDue = UI.isOverdue(asg.dueDate);

        let studentStatusBadge = "";
        if (role === "student") {
          if (mySub) {
            studentStatusBadge = UI.getStatusBadge(mySub.status);
          } else if (isPastDue) {
            studentStatusBadge = UI.getStatusBadge("Late");
          } else {
            studentStatusBadge = UI.getStatusBadge("Pending");
          }
        }

        return `
          <div class="card" id="card-${asg.id}">
            <div>
              <div class="card-header">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.25rem;">
                    <span class="assignment-num-tag">${UI.escapeHtml(asg.assignmentNumber)}</span>
                    <span class="${asg.isSample !== false ? 'sample-badge' : 'live-user-badge'}">${asg.isSample !== false ? 'Sample Demo' : 'Live Task'}</span>
                  </div>
                  <span class="card-subject-title">${UI.escapeHtml(asg.subjectTitle)}</span>
                </div>
                ${
                  role === "student"
                    ? studentStatusBadge
                    : `<span class="badge ${subs.length > 0 ? "badge-submitted" : "badge-pending"}">
                        ${subs.length} ${subs.length === 1 ? "Submission" : "Submissions"}
                       </span>`
                }
              </div>

              <h2 class="card-title">${UI.escapeHtml(asg.title)}</h2>
              <p class="card-description">${UI.escapeHtml(asg.instructions)}</p>
            </div>

            <div>
              <ul class="card-meta-list">
                <li class="card-meta-item">
                  <span>👩‍🏫 Faculty Instructor:</span>
                  <strong>${UI.escapeHtml(asg.facultyName || "Faculty")}</strong>
                </li>
                <li class="card-meta-item">
                  <span>🎯 Assigned To:</span>
                  <span><strong>${UI.escapeHtml(asg.assignedStudentName || "All Students")}</strong></span>
                </li>
                <li class="card-meta-item">
                  <span>📅 Submission Deadline:</span>
                  <span class="deadline-text ${isPastDue && !mySub ? "overdue" : ""}">
                    ${isPastDue && !mySub ? "⚠️ " : "⏳ "} ${UI.formatDate(asg.dueDate)}
                  </span>
                </li>
                <li class="card-meta-item">
                  <span>🎯 Maximum Marks:</span>
                  <span><strong>${asg.maxMarks}</strong> points</span>
                </li>
                ${
                  asg.assignmentFile
                    ? `<li class="card-meta-item">
                        <span>📎 Resource Brief:</span>
                        <span style="font-size:0.8rem; color:var(--primary); font-weight:600;">${UI.escapeHtml(asg.assignmentFile)}</span>
                       </li>`
                    : ""
                }
                ${
                  role === "student" && mySub && mySub.grade !== null
                    ? `<li class="card-meta-item" style="color: var(--status-reviewed); font-weight: 700; border-top: 1px dashed var(--border); padding-top: 0.4rem;">
                        <span>⭐ Earned Score:</span>
                        <span>${mySub.grade} / ${asg.maxMarks} (${Math.round((mySub.grade / asg.maxMarks) * 100)}%)</span>
                       </li>`
                    : ""
                }
              </ul>

              <div class="card-footer">
                ${
                  role === "faculty"
                    ? `
                      <button class="btn btn-secondary btn-sm" onclick="App.openSubmissionsModal('${asg.id}')">
                        🔍 Review (${subs.length})
                      </button>
                      <button class="btn btn-sm btn-action-blue" onclick="App.switchDashboardTab('evaluationsTab')">
                        📊 Evaluations Table
                      </button>
                      <button class="btn btn-sm" style="color: var(--status-late); background: var(--status-late-bg); border-color: #fecaca;" onclick="App.handleDeleteAssignment('${asg.id}')">
                        🗑️ Delete
                      </button>
                    `
                    : `
                      ${
                        mySub
                          ? `<button class="btn btn-secondary btn-sm" onclick="App.openViewSubmissionModal('${asg.id}')">
                              👀 View My Submission & Marks
                             </button>`
                          : `<button class="btn btn-primary btn-sm" onclick="App.openSubmitModal('${asg.id}')">
                              📤 Upload Completed Assignment
                             </button>`
                      }
                    `
                }
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  },

  /**
   * Faculty Submissions & Evaluations Page:
   * Shows each student's name, assigned assignment, submission status, uploaded file, marks, and feedback
   * with buttons for Upload, Review, Mark Completed, and Add Feedback.
   */
  renderEvaluationsPage() {
    const tbody = document.getElementById("evaluationsTableBody");
    if (!tbody) return;

    const students = StorageService.getStudents();
    const assignments = StorageService.getAssignments();
    const submissions = StorageService.getSubmissions();

    const rows = [];

    students.forEach((student) => {
      const studentAssignments = assignments.filter(
        (a) => a.assignedStudentId === "all" || a.assignedStudentId === student.id
      );

      studentAssignments.forEach((asg) => {
        const sub = submissions.find((s) => s.assignmentId === asg.id && s.studentId === student.id);
        const isPastDue = new Date(asg.dueDate).getTime() < Date.now();

        let status = "Pending";
        if (sub) {
          status = sub.status || "Submitted";
        } else if (isPastDue) {
          status = "Late";
        }

        rows.push({
          student,
          asg,
          sub,
          status
        });
      });
    });

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No coursework submissions recorded yet.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows
      .map(({ student, asg, sub, status }) => {
        return `
          <tr>
            <td>
              <div class="student-col-info">
                <span class="student-col-name">${UI.escapeHtml(student.name)}</span>
                <span class="student-col-roll">${UI.escapeHtml(student.rollNumber)}</span>
              </div>
            </td>
            <td>
              <strong style="color: var(--primary);">${UI.escapeHtml(asg.assignmentNumber)}</strong>: 
              <span style="font-weight: 600;">${UI.escapeHtml(asg.title)}</span>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${UI.escapeHtml(asg.subjectTitle)}</div>
            </td>
            <td>${UI.getStatusBadge(status)}</td>
            <td>
              ${
                sub && sub.attachmentName
                  ? `<span style="font-size: 0.82rem; color: var(--primary); font-weight: 600;">📎 ${UI.escapeHtml(sub.attachmentName)}</span>`
                  : `<span style="font-size: 0.8rem; color: var(--text-muted);">Not uploaded</span>`
              }
            </td>
            <td>
              <strong>${sub && sub.grade !== null ? `${sub.grade} / ${asg.maxMarks}` : "—"}</strong>
            </td>
            <td style="max-width: 220px;">
              <span style="font-size: 0.82rem; color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${sub && sub.facultyFeedback ? UI.escapeHtml(sub.facultyFeedback) : "No feedback added"}
              </span>
            </td>
            <td style="text-align: right;">
              <div class="evaluations-table-actions" style="justify-content: flex-end;">
                <!-- 1. Upload Button -->
                <button 
                  class="btn btn-secondary btn-sm" 
                  title="Upload / Create new assignment" 
                  onclick="App.openCreateAssignmentModal()"
                >
                  📤 Upload
                </button>

                <!-- 2. Review Button -->
                <button 
                  class="btn btn-secondary btn-sm" 
                  title="Review submission details" 
                  onclick="${sub ? `App.openSubmissionsModal('${asg.id}')` : `alert('Student has not yet submitted this assignment.')`}"
                >
                  🔍 Review
                </button>

                <!-- 3. Mark Completed Button -->
                <button 
                  class="btn btn-sm btn-action-green" 
                  title="Mark status as Reviewed / Completed" 
                  onclick="${sub ? `App.quickMarkCompleted('${sub.id}')` : `alert('Student must submit coursework before it can be marked completed.')`}"
                >
                  ✅ Mark Completed
                </button>

                <!-- 4. Add Feedback Button -->
                <button 
                  class="btn btn-primary btn-sm" 
                  title="Add marks and written remarks" 
                  onclick="${sub ? `App.openGradeModal('${sub.id}', '${asg.id}')` : `alert('Student must submit coursework before feedback can be entered.')`}"
                >
                  💬 Add Feedback
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  },

  /**
   * One-click action for Prof. Clara to mark submission status as Completed/Reviewed
   */
  quickMarkCompleted(submissionId) {
    const submissions = StorageService.getSubmissions();
    const sub = submissions.find((s) => s.id === submissionId);
    if (!sub) return;

    StorageService.updateSubmissionReview(
      submissionId,
      sub.grade !== null ? sub.grade : 100,
      sub.facultyFeedback || "Assignment verified and marked completed.",
      "Reviewed"
    );

    UI.showToast("Assignment verified and marked as Completed / Reviewed!", "success");
    this.render();
  },

  /**
   * Render Dedicated Faculty Feedback & Marks Page (Tab 2 for Students)
   */
  renderFeedbackPage() {
    const role = AuthService.getRole();
    const user = AuthService.getCurrentUser();
    const summaryContainer = document.getElementById("feedbackSummaryGrid");
    const cardsContainer = document.getElementById("feedbackCardsContainer");

    if (!summaryContainer || !cardsContainer) return;

    if (role === "student") {
      const summary = StorageService.getStudentAcademicSummary(user.id);
      const records = StorageService.getStudentFeedbackRecords(user.id);

      summaryContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon green">🎯</div>
          <div>
            <div class="stat-number">${summary.averagePercentage > 0 ? summary.averagePercentage + "%" : "—"}</div>
            <div class="stat-label">Cumulative Score Average</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue">⭐</div>
          <div>
            <div class="stat-number">${summary.reviewedCount} / ${summary.totalAssigned}</div>
            <div class="stat-label">Evaluated Coursework</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">🏆</div>
          <div>
            <div class="stat-number">${summary.highestScore > 0 ? summary.highestScore : "—"}</div>
            <div class="stat-label">Highest Score Achieved</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon yellow">⏳</div>
          <div>
            <div class="stat-number">${summary.submittedCount - summary.reviewedCount}</div>
            <div class="stat-label">Pending Faculty Review</div>
          </div>
        </div>
      `;

      if (records.length === 0) {
        cardsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <h3 class="empty-state-title">No evaluated assignments yet</h3>
            <p class="empty-state-text">Once your faculty instructor reviews your submitted coursework and enters marks, your feedback report will appear here.</p>
          </div>
        `;
        return;
      }

      cardsContainer.innerHTML = records
        .map((rec) => {
          const hasScore = rec.grade !== null && rec.grade !== undefined;

          return `
            <div class="feedback-card">
              <div class="feedback-card-header">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                    <span class="assignment-num-tag">${UI.escapeHtml(rec.assignmentNumber)}</span>
                    <span style="font-size: 0.82rem; font-weight: 700; color: var(--secondary);">${UI.escapeHtml(rec.subjectTitle)}</span>
                    ${UI.getStatusBadge(rec.status)}
                  </div>
                  <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">${UI.escapeHtml(rec.assignmentTitle)}</h3>
                  <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
                    Instructor: <strong>Prof. ${UI.escapeHtml(rec.facultyName)}</strong> | Due: ${UI.formatDate(rec.dueDate)}
                  </div>
                </div>

                <div class="feedback-score-badge">
                  <div class="feedback-score-num">${hasScore ? rec.grade : "—"}</div>
                  <div class="feedback-score-max">/ ${rec.maxMarks} pts ${hasScore ? `(${rec.percentage}%)` : ""}</div>
                </div>
              </div>

              ${
                rec.facultyFeedback
                  ? `
                    <div class="feedback-remark-box">
                      <div class="feedback-remark-title">
                        <span>💬 Faculty Evaluation Remarks:</span>
                      </div>
                      <p class="feedback-remark-text">"${UI.escapeHtml(rec.facultyFeedback)}"</p>
                    </div>
                  `
                  : hasScore
                  ? `
                    <div class="feedback-remark-box" style="background:#f8fafc; border-color:#e2e8f0; border-left-color:var(--secondary);">
                      <p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">Marks awarded. No detailed written remarks provided.</p>
                    </div>
                  `
                  : `
                    <div class="feedback-remark-box" style="background:#fffbeb; border-color:#fde68a; border-left-color:var(--status-pending);">
                      <p style="font-size: 0.85rem; color:#b45309;">
                        ${rec.isSubmitted ? "📬 Submission turned in. Awaiting faculty review." : "⏳ Not yet submitted. Turn in your completed assignment from the Coursework tab."}
                      </p>
                    </div>
                  `
              }

              <div class="feedback-meta-row">
                <div>
                  ${
                    rec.isSubmitted
                      ? `<span>Submitted on: <strong>${UI.formatDate(rec.submittedAt)}</strong></span>`
                      : `<span style="color: var(--status-pending);">Status: Pending Submission</span>`
                  }
                </div>
                <div>
                  ${
                    rec.attachmentName
                      ? `<span>📎 Attached Document: <strong style="color: var(--primary);">${UI.escapeHtml(rec.attachmentName)}</strong></span>`
                      : `<span>No document attached</span>`
                  }
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    }
  },

  /**
   * Render 12 Course Subjects
   */
  renderSubjects() {
    const subjects = StorageService.getCourseSubjects();
    const count = subjects.length;

    const autoCounter = document.getElementById("autoSubjectCounter");
    const listCount = document.getElementById("subjectListCount");
    const tabBadge = document.getElementById("tabSubjectsBadge");
    const welcomeCount = document.getElementById("welcomeSubjectCount");

    if (autoCounter) autoCounter.textContent = count;
    if (listCount) listCount.textContent = count;
    if (tabBadge) tabBadge.textContent = count;
    if (welcomeCount) welcomeCount.textContent = count;
    const welcomeStudentCount = document.getElementById("welcomeStudentCount");
    if (welcomeStudentCount) welcomeStudentCount.textContent = StorageService.getStudents().length;

    const grid = document.getElementById("courseSubjectsGrid");
    if (!grid) return;

    grid.innerHTML = subjects
      .map(
        (sub) => `
        <div class="subject-item-card">
          <div>
            <span class="subject-code">${UI.escapeHtml(sub.code)}</span>
            <h4 class="subject-name">${UI.escapeHtml(sub.title)}</h4>
          </div>
          <span class="subject-category-pill">${UI.escapeHtml(sub.category)}</span>
        </div>
      `
      )
      .join("");
  },

  /**
   * Render Other Academic Activities (7 activities)
   */
  renderActivities() {
    const activities = StorageService.getOtherAcademicActivities();
    const grid = document.getElementById("activitiesGrid");
    if (!grid) return;

    grid.innerHTML = activities
      .map(
        (act) => `
        <div class="activity-item-card">
          <div class="activity-icon">${act.icon}</div>
          <div class="activity-title">${UI.escapeHtml(act.title)}</div>
          <p class="activity-desc">${UI.escapeHtml(act.description)}</p>
          <span class="non-credit-pill">Non-Credit Session</span>
        </div>
      `
      )
      .join("");
  },

  /**
   * Render Student Directory Table
   */
  renderDirectory() {
    let records = StorageService.getStudentDirectoryRecords();
    const tbody = document.getElementById("directoryTableBody");
    if (!tbody) return;

    if (this.directoryFilters.searchQuery) {
      records = records.filter(
        (r) =>
          r.studentName.toLowerCase().includes(this.directoryFilters.searchQuery) ||
          r.studentRoll.toLowerCase().includes(this.directoryFilters.searchQuery) ||
          r.subject.toLowerCase().includes(this.directoryFilters.searchQuery) ||
          r.assignmentTitle.toLowerCase().includes(this.directoryFilters.searchQuery)
      );
    }

    if (this.directoryFilters.status !== "all") {
      records = records.filter((r) => r.status.toLowerCase() === this.directoryFilters.status.toLowerCase());
    }

    if (records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No student directory records available yet. Registered students and their coursework will appear here.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = records
      .map(
        (rec) => `
        <tr>
          <td>
            <div class="student-col-info">
              <span class="student-col-name">${UI.escapeHtml(rec.studentName)}</span>
              <span class="student-col-roll">${UI.escapeHtml(rec.studentRoll)}</span>
            </div>
          </td>
          <td><strong>${UI.escapeHtml(rec.subject)}</strong></td>
          <td>
            <span style="font-weight: 600; color: var(--primary);">${UI.escapeHtml(rec.assignmentNumber)}</span>:
            <span style="font-size: 0.85rem; color: var(--text-muted); display: block;">${UI.escapeHtml(rec.assignmentTitle)}</span>
          </td>
          <td>${UI.getStatusBadge(rec.status)}</td>
          <td><strong>${UI.escapeHtml(String(rec.marks))}</strong></td>
          <td><span style="font-weight: 600; color: var(--secondary);">${UI.escapeHtml(rec.facultyName)}</span></td>
        </tr>
      `
      )
      .join("");
  },

  /**
   * Clara: Open modal to create and assign coursework
   */
  openCreateAssignmentModal() {
    if (AuthService.getRole() !== "faculty") {
      UI.showToast("⛔ Permission Denied: Faculty authorization required to create assignments.", "danger");
      return;
    }

    const form = document.getElementById("assignmentForm");
    if (form) form.reset();

    const currentUser = AuthService.getCurrentUser();
    const facultyNameInput = document.getElementById("formFacultyName");
    if (facultyNameInput) {
      facultyNameInput.value = currentUser ? (currentUser.title || currentUser.name || "Faculty") : "Faculty";
    }
    document.getElementById("formAssignmentNumber").value = "Assignment 1";
    document.getElementById("formDueDate").min = new Date().toISOString().slice(0, 16);

    if (!this.activeScannedAttachment) {
      const badge = document.getElementById("scannedAttachmentBadge");
      if (badge) badge.style.display = "none";
    }

    UI.openModal("assignmentModal");
  },

  /**
   * Clara: Save assignment
   */
  handleAssignmentSubmit(e) {
    e.preventDefault();

    if (AuthService.getRole() !== "faculty") {
      UI.showToast("⛔ Permission Denied: Only faculty can publish coursework.", "danger");
      return;
    }

    const assignmentNumber = document.getElementById("formAssignmentNumber").value.trim();
    const title = document.getElementById("formTitle").value.trim();
    const subjectSelect = document.getElementById("formSubjectId");
    const subjectId = subjectSelect.value;
    const subjectTitle = subjectSelect.options[subjectSelect.selectedIndex]?.dataset?.title || "Subject";
    const facultyName = document.getElementById("formFacultyName").value.trim() || (AuthService.getCurrentUser()?.title || AuthService.getCurrentUser()?.name || "Faculty");

    const studentSelect = document.getElementById("formAssignedStudent");
    const assignedStudentId = studentSelect.value;
    const assignedStudentName = studentSelect.options[studentSelect.selectedIndex]?.dataset?.name || "All Students";

    const instructions = document.getElementById("formInstructions").value.trim();
    const dueDate = document.getElementById("formDueDate").value;
    const maxMarks = parseInt(document.getElementById("formMaxMarks").value, 10);
    const fileInput = document.getElementById("formAssignmentFile");
    let assignmentFile = "coursework_brief.pdf";
    if (this.activeScannedAttachment && this.activeScannedAttachment.name) {
      assignmentFile = this.activeScannedAttachment.name;
    } else if (fileInput && fileInput.files && fileInput.files.length > 0) {
      assignmentFile = fileInput.files[0].name;
    }

    if (!title || !subjectId || !dueDate || isNaN(maxMarks)) {
      UI.showToast("Please fill in all mandatory assignment fields.", "warning");
      return;
    }

    let fileObjToUpload = null;
    if (this.activeScannedAttachment && this.activeScannedAttachment.blob) {
      fileObjToUpload = this.activeScannedAttachment.blob;
    } else if (fileInput && fileInput.files && fileInput.files.length > 0) {
      fileObjToUpload = fileInput.files[0];
    }

    const asgRecord = StorageService.saveAssignment({
      assignmentNumber,
      title,
      subjectId,
      subjectTitle,
      facultyName,
      assignedStudentId,
      assignedStudentName,
      instructions,
      dueDate,
      maxMarks,
      assignmentFile,
      isSample: false
    });

    if (fileObjToUpload && typeof FirebaseService !== "undefined" && FirebaseService.isLive()) {
      FirebaseService.uploadFileToStorage("assignments", fileObjToUpload, assignmentFile).then((uploadRes) => {
        if (uploadRes && uploadRes.downloadUrl) {
          asgRecord.attachmentUrl = uploadRes.downloadUrl;
          StorageService.saveAssignment(asgRecord);
        }
      });
    }

    this.removeScannedAttachment();
    UI.closeModal("assignmentModal");
    UI.showToast(`Assigned "${assignmentNumber}" successfully!`, "success");
    this.render();
  },

  /**
   * Clara: Delete an assignment
   */
  handleDeleteAssignment(asgId) {
    if (AuthService.getRole() !== "faculty") {
      UI.showToast("⛔ Permission Denied: Only faculty can delete coursework.", "danger");
      return;
    }

    const asg = StorageService.getAssignmentById(asgId);
    if (!asg) return;

    if (confirm(`Delete "${asg.title}"? Any student submissions for this assignment will also be removed.`)) {
      StorageService.deleteAssignment(asgId);
      UI.showToast("Assignment removed.", "info");
      this.render();
    }
  },

  /**
   * Clara: Open modal listing student submissions for an assignment
   */
  openSubmissionsModal(asgId) {
    if (AuthService.getRole() !== "faculty") {
      UI.showToast("⛔ Permission Denied: Only faculty can inspect all submissions.", "danger");
      return;
    }

    const asg = StorageService.getAssignmentById(asgId);
    if (!asg) return;

    const submissions = StorageService.getSubmissionsByAssignmentId(asgId);
    document.getElementById("submissionsModalTitle").textContent = `${asg.assignmentNumber} Submissions: ${asg.title}`;

    const container = document.getElementById("submissionsListContainer");
    if (!container) return;

    if (submissions.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <p>No student has turned in this assignment yet.</p>
        </div>
      `;
    } else {
      container.innerHTML = submissions
        .map(
          (sub) => `
          <div style="border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.15rem; margin-bottom: 1rem; background: var(--bg-main);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <div>
                <strong style="font-size: 0.95rem;">${UI.escapeHtml(sub.studentName)}</strong> 
                <span style="font-size: 0.8rem; color: var(--text-muted);">(${UI.escapeHtml(sub.studentRoll)})</span>
              </div>
              <div>${UI.getStatusBadge(sub.status)}</div>
            </div>

            <p style="font-size: 0.88rem; margin-bottom: 0.5rem; background: white; padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid var(--border);">
              ${UI.escapeHtml(sub.content)}
            </p>

            ${
              sub.attachmentName
                ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                    📎 Uploaded Student File: <strong>${UI.escapeHtml(sub.attachmentName)}</strong>
                   </div>`
                : ""
            }

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-muted); border-top: 1px dashed var(--border); padding-top: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
              <span>Submitted: ${UI.formatDate(sub.submittedAt)}</span>
              <div style="display: flex; gap: 0.4rem;">
                <button class="btn btn-sm btn-action-green" onclick="App.quickMarkCompleted('${sub.id}')">
                  ✅ Mark Completed
                </button>
                <button class="btn btn-primary btn-sm" onclick="App.openGradeModal('${sub.id}', '${asg.id}')">
                  💬 Add Feedback & Marks
                </button>
              </div>
            </div>
          </div>
        `
        )
        .join("");
    }

    UI.openModal("submissionsModal");
  },

  /**
   * Clara: Open Grade & Status Update Modal (Add Feedback & Marks)
   */
  openGradeModal(submissionId, assignmentId) {
    if (AuthService.getRole() !== "faculty") {
      UI.showToast("⛔ Permission Denied: Only faculty can grade and add feedback.", "danger");
      return;
    }

    const submissions = StorageService.getSubmissions();
    const sub = submissions.find((s) => s.id === submissionId);
    const asg = StorageService.getAssignmentById(assignmentId);
    if (!sub || !asg) return;

    document.getElementById("gradeSubmissionId").value = sub.id;
    document.getElementById("gradeStudentInfo").textContent = `${sub.studentName} (${sub.studentRoll})`;
    document.getElementById("gradeAssignmentInfo").textContent = `${asg.assignmentNumber} – ${asg.title} (${asg.subjectTitle}) | Max: ${asg.maxMarks}`;
    document.getElementById("gradeInput").max = asg.maxMarks;
    document.getElementById("gradeInput").value = sub.grade !== null ? sub.grade : "";
    document.getElementById("feedbackInput").value = sub.facultyFeedback || "";
    document.getElementById("gradeStatusSelect").value = sub.status || "Reviewed";

    UI.openModal("gradeModal");
  },

  /**
   * Clara: Submit evaluation with Marks, Feedback, and Status update
   */
  handleGradeSubmit(e) {
    e.preventDefault();

    if (AuthService.getRole() !== "faculty") {
      UI.showToast("⛔ Permission Denied: Faculty authorization required to record marks.", "danger");
      return;
    }
    const subId = document.getElementById("gradeSubmissionId").value;
    const grade = document.getElementById("gradeInput").value;
    const feedback = document.getElementById("feedbackInput").value;
    const status = document.getElementById("gradeStatusSelect").value;

    if (grade === "" || isNaN(grade)) {
      UI.showToast("Please enter a valid numeric grade.", "warning");
      return;
    }

    const currentFaculty = AuthService.getCurrentUser();
    const facultyName = currentFaculty ? (currentFaculty.title || currentFaculty.name) : "Faculty";
    StorageService.updateSubmissionReview(subId, grade, feedback, status, facultyName);
    UI.closeModal("gradeModal");
    UI.closeModal("submissionsModal");
    UI.showToast(`Submission evaluated and marked as "${status}"!`, "success");
    this.render();
  },

  /**
   * Student: Open submission modal with full details
   */
  openSubmitModal(asgId) {
    if (AuthService.getRole() !== "student") {
      UI.showToast("ℹ️ Faculty members review student submissions rather than submitting coursework.", "warning");
      return;
    }

    const asg = StorageService.getAssignmentById(asgId);
    if (!asg) return;

    document.getElementById("submitAssignmentId").value = asg.id;
    document.getElementById("submitModalTitle").textContent = `Submit: ${asg.assignmentNumber}`;
    document.getElementById("submitAsgSubjectLabel").textContent = asg.subjectTitle;
    document.getElementById("submitAsgTitleLabel").textContent = asg.title;
    document.getElementById("submitAsgFacultyLabel").textContent = asg.facultyName || "Faculty";
    document.getElementById("submitAsgDeadlineLabel").textContent = UI.formatDate(asg.dueDate);

    document.getElementById("submissionForm").reset();
    this.clearStudentAttachment();

    UI.openModal("submitModal");
  },

  /**
   * Student Mobile Camera Snap Handler
   */
  handleStudentCameraSnap(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    this.studentSelectedAttachment = {
      name: `Photo_Homework_${Date.now().toString().slice(-4)}.jpg`,
      size: file.size,
      type: file.type,
      fileObj: file
    };

    const badge = document.getElementById("submitAttachmentBadge");
    const nameLabel = document.getElementById("submitAttachmentName");
    const fileInput = document.getElementById("submitFile");

    if (badge && nameLabel) {
      nameLabel.textContent = `📸 ${this.studentSelectedAttachment.name} (${Math.round(file.size / 1024)} KB)`;
      badge.style.display = "flex";
    }
    if (fileInput) {
      fileInput.required = false;
    }
    UI.showToast("📸 Photo captured & attached!", "success");
  },

  /**
   * Clear student attached document/photo
   */
  clearStudentAttachment() {
    this.studentSelectedAttachment = null;
    const badge = document.getElementById("submitAttachmentBadge");
    const nameLabel = document.getElementById("submitAttachmentName");
    const fileInput = document.getElementById("submitFile");
    const cameraInput = document.getElementById("submitCameraInput");

    if (badge) badge.style.display = "none";
    if (nameLabel) nameLabel.textContent = "";
    if (fileInput) {
      fileInput.value = "";
      fileInput.required = true;
    }
    if (cameraInput) {
      cameraInput.value = "";
    }
  },

  /**
   * Student: Submit completed assignment with file upload or camera photo
   */
  handleStudentSubmission(e) {
    e.preventDefault();

    if (AuthService.getRole() !== "student") {
      UI.showToast("⛔ Permission Denied: Only students can upload solutions.", "danger");
      return;
    }
    const asgId = document.getElementById("submitAssignmentId").value;
    const content = document.getElementById("submitContent").value.trim();
    const fileInput = document.getElementById("submitFile");

    if (!content) {
      UI.showToast("Please enter your solution summary or answer.", "warning");
      return;
    }

    if ((!fileInput.files || fileInput.files.length === 0) && !this.studentSelectedAttachment) {
      UI.showToast("Please attach your completed assignment document or take a photo.", "warning");
      return;
    }

    const attachmentName = this.studentSelectedAttachment
      ? this.studentSelectedAttachment.name
      : (fileInput.files[0] ? fileInput.files[0].name : "completed_assignment.pdf");

    const student = AuthService.getCurrentUser();

    let fileObjToUpload = null;
    if (this.studentSelectedAttachment && this.studentSelectedAttachment.fileObj) {
      fileObjToUpload = this.studentSelectedAttachment.fileObj;
    } else if (fileInput && fileInput.files && fileInput.files.length > 0) {
      fileObjToUpload = fileInput.files[0];
    }

    const subRecord = StorageService.submitAssignment({
      assignmentId: asgId,
      studentId: student.id,
      studentName: student.name,
      studentRoll: student.rollNumber,
      content,
      attachmentName,
      isSample: false
    });

    if (fileObjToUpload && typeof FirebaseService !== "undefined" && FirebaseService.isLive()) {
      FirebaseService.uploadFileToStorage(`submissions/${student.id}`, fileObjToUpload, attachmentName).then((uploadRes) => {
        if (uploadRes && uploadRes.downloadUrl) {
          subRecord.attachmentUrl = uploadRes.downloadUrl;
          StorageService.submitAssignment(subRecord);
        }
      });
    }

    this.clearStudentAttachment();
    UI.closeModal("submitModal");
    UI.showToast("Assignment uploaded and submitted successfully!", "success");
    this.render();
  },

  /**
   * Student: View submission and Clara's evaluation
   */
  openViewSubmissionModal(asgId) {
    if (AuthService.getRole() !== "student") {
      UI.showToast("ℹ️ Faculty members evaluate coursework in the Evaluations tab.", "info");
      return;
    }

    const asg = StorageService.getAssignmentById(asgId);
    const student = AuthService.getCurrentUser();
    const sub = StorageService.getStudentSubmission(asgId, student.id);
    if (!asg || !sub) return;

    document.getElementById("viewSubTitle").textContent = `${asg.assignmentNumber}: ${asg.title}`;
    document.getElementById("viewSubSubject").textContent = asg.subjectTitle;
    document.getElementById("viewSubStatusBadge").innerHTML = UI.getStatusBadge(sub.status);
    document.getElementById("viewSubDate").textContent = UI.formatDate(sub.submittedAt);
    document.getElementById("viewSubContent").textContent = sub.content;
    document.getElementById("viewSubFile").textContent = sub.attachmentName || "No file attached";

    const feedbackSection = document.getElementById("viewSubFeedbackSection");
    if (sub.grade !== null || sub.facultyFeedback) {
      feedbackSection.style.display = "block";
      document.getElementById("viewSubMarks").textContent = sub.grade !== null ? `${sub.grade} / ${asg.maxMarks} marks` : "In Progress";
      document.getElementById("viewSubFeedback").textContent = sub.facultyFeedback || "No written remarks provided.";
    } else {
      feedbackSection.style.display = "none";
    }

    UI.openModal("viewSubmissionModal");
  },

  /* ==========================================================================
     FACULTY DOCUMENT SCANNER & CAMERA MODULE
     ========================================================================== */

  /**
   * Initializes scanner drag-and-drop and file input listeners
   */
  initScanner() {
    const dropzone = document.getElementById("scannerDropzone");
    const fileInput = document.getElementById("scannerFileInput");

    if (dropzone && fileInput) {
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("dragover");
      });

      dropzone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("dragover");
      });

      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("dragover");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleScannerFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleScannerFile(e.target.files[0]);
        }
      });
    }
  },

  /**
   * Opens the Document Scanner modal (Faculty only)
   * @param {string} target - 'standalone' | 'assignmentForm'
   */
  openScannerModal(target = "standalone") {
    if (AuthService.getRole() !== "faculty") {
      UI.showToast("⛔ Permission Denied: Document scanner is reserved for faculty.", "danger");
      return;
    }

    this.scannerTarget = target;
    this.switchScannerMode("upload");
    UI.openModal("scannerModal");
  },

  /**
   * Closes the Document Scanner modal and releases hardware resources
   */
  closeScannerModal() {
    this.stopScannerCamera();
    UI.closeModal("scannerModal");
  },

  /**
   * Switches between Document Upload and Camera Scanner modes
   * @param {string} mode - 'upload' | 'camera'
   */
  switchScannerMode(mode) {
    const btnUpload = document.getElementById("scannerTabBtnUpload");
    const btnCamera = document.getElementById("scannerTabBtnCamera");
    const secUpload = document.getElementById("scannerUploadSection");
    const secCamera = document.getElementById("scannerCameraSection");

    const isUpload = mode === "upload";

    if (btnUpload && btnCamera && secUpload && secCamera) {
      btnUpload.classList.toggle("active", isUpload);
      btnCamera.classList.toggle("active", !isUpload);
      secUpload.style.display = isUpload ? "block" : "none";
      secCamera.style.display = !isUpload ? "block" : "none";
    }

    if (isUpload) {
      // Pause camera if user switches to upload
      this.stopScannerCamera();
    } else {
      // Check camera capabilities
      this.checkCameraCapabilities();
    }
  },

  /**
   * Verifies browser camera API support and checks for connected devices
   */
  async checkCameraCapabilities() {
    const errorAlert = document.getElementById("scannerCameraErrorAlert");
    const switchLensBtn = document.getElementById("scannerSwitchLensBtn");

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      if (errorAlert) {
        errorAlert.innerHTML = `
          <span style="font-size: 1.15rem; line-height: 1;">⚠️</span>
          <div>
            <strong>Camera Scanner Unsupported:</strong> 
            This browser does not support the WebRTC MediaDevices API or requires an encrypted HTTPS connection. 
            Please use the <strong>Document Upload</strong> tab to submit PDF or image files.
          </div>
        `;
        errorAlert.style.display = "flex";
      }
      return false;
    }

    if (errorAlert) errorAlert.style.display = "none";

    // Enumerate devices to see if multiple cameras are available
    try {
      if (navigator.mediaDevices.enumerateDevices) {
        const devicesPromise = navigator.mediaDevices.enumerateDevices();
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve([]), 500));
        const devices = await Promise.race([devicesPromise, timeoutPromise]);
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        if (switchLensBtn) {
          switchLensBtn.style.display = videoDevices.length > 1 ? "inline-flex" : "none";
        }
      }
    } catch (e) {
      // enumerateDevices might be restricted before permission grant
    }

    return true;
  },

  /**
   * Toggles camera stream on or off
   */
  toggleScannerCamera() {
    if (this.scannerMediaStream) {
      this.stopScannerCamera();
    } else {
      this.startScannerCamera();
    }
  },

  /**
   * Requests camera permission and streams video into viewfinder
   */
  async startScannerCamera() {
    const video = document.getElementById("scannerVideo");
    const toggleBtn = document.getElementById("scannerToggleCameraBtn");
    const captureBtn = document.getElementById("scannerCaptureBtn");
    const statusPill = document.getElementById("scannerStreamStatus");
    const statusText = document.getElementById("scannerStatusText");
    const errorAlert = document.getElementById("scannerCameraErrorAlert");

    if (errorAlert) errorAlert.style.display = "none";

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      UI.showToast("Camera scanning is not supported in this environment.", "warning");
      return;
    }

    if (toggleBtn) {
      toggleBtn.disabled = true;
      toggleBtn.textContent = "Connecting...";
    }
    if (statusText) statusText.textContent = "Requesting permission...";

    try {
      const constraints = {
        video: {
          facingMode: { ideal: this.scannerFacingMode || "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.scannerMediaStream = stream;

      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      if (toggleBtn) {
        toggleBtn.disabled = false;
        toggleBtn.textContent = "⏹️ Stop Camera";
      }
      if (captureBtn) captureBtn.disabled = false;
      if (statusPill) statusPill.classList.add("live");
      if (statusText) statusText.textContent = "🟢 Camera Live";

      UI.showToast("Camera connected! Align page and click 'Capture Page'.", "info");
    } catch (err) {
      console.warn("Camera access error:", err);

      if (toggleBtn) {
        toggleBtn.disabled = false;
        toggleBtn.textContent = "▶️ Start Camera";
      }
      if (captureBtn) captureBtn.disabled = true;
      if (statusPill) statusPill.classList.remove("live");
      if (statusText) statusText.textContent = "Camera Off";

      let errorMsg = "Unable to start camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMsg = "<strong>Camera Permission Denied:</strong> Please click the camera icon in your browser URL bar, change permission to 'Allow', and click 'Start Camera' again.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMsg = "<strong>No Camera Detected:</strong> No webcam was found on this computer. You can upload PDF or image documents instead.";
      } else if (err.name === "NotReadableError") {
        errorMsg = "<strong>Camera Busy:</strong> The webcam is currently in use by another application.";
      }

      if (errorAlert) {
        errorAlert.innerHTML = `<span style="font-size: 1.15rem; line-height: 1;">⚠️</span><div>${errorMsg}</div>`;
        errorAlert.style.display = "flex";
      }
      UI.showToast(err.name === "NotAllowedError" ? "Camera permission denied." : "Could not open camera.", "danger");
    }
  },

  /**
   * Stops active camera stream and frees video tracks
   */
  stopScannerCamera() {
    if (this.scannerMediaStream) {
      this.scannerMediaStream.getTracks().forEach((track) => track.stop());
      this.scannerMediaStream = null;
    }

    const video = document.getElementById("scannerVideo");
    if (video) video.srcObject = null;

    const toggleBtn = document.getElementById("scannerToggleCameraBtn");
    const captureBtn = document.getElementById("scannerCaptureBtn");
    const statusPill = document.getElementById("scannerStreamStatus");
    const statusText = document.getElementById("scannerStatusText");

    if (toggleBtn) {
      toggleBtn.disabled = false;
      toggleBtn.textContent = "▶️ Start Camera";
    }
    if (captureBtn) captureBtn.disabled = true;
    if (statusPill) statusPill.classList.remove("live");
    if (statusText) statusText.textContent = "Camera Off";
  },

  /**
   * Switches camera facing mode (rear environment vs front user)
   */
  switchScannerCamera() {
    this.scannerFacingMode = this.scannerFacingMode === "environment" ? "user" : "environment";
    this.stopScannerCamera();
    this.startScannerCamera();
  },

  /**
   * Captures a high-resolution snapshot frame from the camera onto canvas
   */
  captureScannerPage() {
    const video = document.getElementById("scannerVideo");
    const canvas = document.getElementById("scannerCanvas");

    if (!video || !canvas || !this.scannerMediaStream) {
      UI.showToast("Please start the camera before capturing.", "warning");
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const timeStamp = Date.now().toString().slice(-4);
    const fileName = `Scanned_Assignment_Doc_${dateStamp}_${timeStamp}.jpg`;

    this.scannedDocument = {
      name: fileName,
      type: "image/jpeg",
      dataUrl: dataUrl,
      size: Math.round((dataUrl.length * 3) / 4),
      isPdf: false,
      source: "camera",
      capturedAt: new Date().toISOString()
    };

    this.renderScannedPreview();
    UI.showToast("📸 Page captured! Review the preview below.", "success");
  },

  /**
   * Processes a PDF or Image file selected or dragged into the dropzone
   */
  handleScannerFile(file) {
    if (!file) return Promise.resolve(null);

    return new Promise((resolve) => {
      const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);

      if (!isPdf && !isImage) {
        UI.showToast("Unsupported file format. Please upload a PDF or image file (PNG, JPG, WEBP).", "warning");
        resolve(null);
        return;
      }

      // 25MB Max file size
      if (file.size > 25 * 1024 * 1024) {
        UI.showToast("File exceeds the maximum size limit of 25MB.", "warning");
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        this.scannedDocument = {
          name: file.name,
          type: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
          size: file.size,
          dataUrl: e.target.result,
          isPdf: isPdf,
          source: "upload",
          capturedAt: new Date().toISOString()
        };
        this.renderScannedPreview();
        UI.showToast(`✅ "${file.name}" loaded into scanner preview!`, "success");
        resolve(this.scannedDocument);
      };

      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Renders preview and actions for the captured or uploaded document
   */
  renderScannedPreview() {
    const card = document.getElementById("scannedDocumentCard");
    const nameEl = document.getElementById("scannedFileName");
    const metaEl = document.getElementById("scannedFileMeta");
    const iconEl = document.getElementById("scannedFileTypeIcon");
    const imgPreview = document.getElementById("scannedImagePreview");
    const pdfPlaceholder = document.getElementById("scannedPdfPlaceholder");

    if (!card || !this.scannedDocument) return;

    const doc = this.scannedDocument;
    if (nameEl) nameEl.textContent = doc.name;
    if (metaEl) {
      const sizeFormatted = (doc.size / 1024).toFixed(1) + " KB";
      const sourceLabel = doc.source === "camera" ? "Live Camera Capture" : "Local File Upload";
      metaEl.textContent = `${doc.isPdf ? "PDF Document" : "JPEG Image"} • ${sizeFormatted} • ${sourceLabel}`;
    }

    if (iconEl) iconEl.textContent = doc.isPdf ? "📑" : "🖼️";

    if (doc.isPdf) {
      if (imgPreview) imgPreview.style.display = "none";
      if (pdfPlaceholder) pdfPlaceholder.style.display = "block";
    } else {
      if (pdfPlaceholder) pdfPlaceholder.style.display = "none";
      if (imgPreview) {
        imgPreview.src = doc.dataUrl;
        imgPreview.style.display = "block";
      }
    }

    card.style.display = "block";
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },

  /**
   * Pre-fills the scanned document into Clara's Create Assignment modal
   */
  attachScannedDocumentToAssignment() {
    if (!this.scannedDocument) {
      UI.showToast("Please capture or upload a document first.", "warning");
      return;
    }

    this.activeScannedAttachment = this.scannedDocument;

    const badge = document.getElementById("scannedAttachmentBadge");
    const nameEl = document.getElementById("scannedAttachmentName");

    if (badge && nameEl) {
      nameEl.textContent = `${this.scannedDocument.name} (${(this.scannedDocument.size / 1024).toFixed(1)} KB)`;
      badge.style.display = "inline-flex";
    }

    this.closeScannerModal();
    this.openCreateAssignmentModal();
    UI.showToast(`📎 Scanned document attached to Assignment: ${this.scannedDocument.name}`, "success");
  },

  /**
   * Removes attached scanned document from assignment form
   */
  removeScannedAttachment() {
    this.activeScannedAttachment = null;
    const badge = document.getElementById("scannedAttachmentBadge");
    if (badge) badge.style.display = "none";
    UI.showToast("Scanned attachment removed from assignment form.", "info");
  },

  /**
   * Triggers download of the captured or uploaded scanned file
   */
  downloadScannedDocument() {
    if (!this.scannedDocument || !this.scannedDocument.dataUrl) {
      UI.showToast("No document available for download.", "warning");
      return;
    }

    const a = document.createElement("a");
    a.href = this.scannedDocument.dataUrl;
    a.download = this.scannedDocument.name;
    document.body.appendChild(a);
    a.click();
    a.remove();

    UI.showToast(`💾 Downloading "${this.scannedDocument.name}"...`, "info");
  },

  /**
   * Resets scanned preview to scan another page
   */
  resetScannedDocument() {
    this.scannedDocument = null;
    const card = document.getElementById("scannedDocumentCard");
    const fileInput = document.getElementById("scannerFileInput");

    if (card) card.style.display = "none";
    if (fileInput) fileInput.value = "";

    UI.showToast("Ready to scan or upload another document.", "info");
  }
};

// Launch application on DOM load
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
