/**
 * DATA.JS - Academic Reference Data
 * Timetable-aligned course subjects and non-credit academic activities.
 * Clean production state: No demo faculty, students, assignments, or submissions.
 */

const SEED_DATA = {
  // Real Academic Course Subjects (12 accredited courses)
  courseSubjects: [
    { id: "SUB_01", code: "MD-401", title: "Machine Design", category: "Core Theory" },
    { id: "SUB_02", code: "IE-402", title: "Industrial Electronics", category: "Core Theory" },
    { id: "SUB_03", code: "ESP-403", title: "Embedded Systems and Programming", category: "Core Theory" },
    { id: "SUB_04", code: "ESPL-404", title: "Embedded Systems and Programming Laboratory", category: "Practical Lab" },
    { id: "SUB_05", code: "MEMS-405", title: "Micro Electromechanical Systems", category: "Core Theory" },
    { id: "SUB_06", code: "IA-406", title: "Integrated Automation", category: "Core Theory" },
    { id: "SUB_07", code: "OE-407", title: "Open Elective II – Introduction to [Title TBD]", category: "Elective" },
    { id: "SUB_08", code: "MP-408", title: "Mini Project II", category: "Project" },
    { id: "SUB_09", code: "CCT-409", title: "Career Course Track 1 – Personnel Psychology and Technical Skills", category: "Career Track" },
    { id: "SUB_10", code: "CCT-410", title: "Career Course Track 2 – Entrepreneurial and Business Canvas Model", category: "Career Track" },
    { id: "SUB_11", code: "CCT-411", title: "Career Course Track 3 – Competency Skills for Higher Education", category: "Career Track" },
    { id: "SUB_12", code: "CCT-412", title: "Career Course Track 4 – Foundation Course on Competitive Exams", category: "Career Track" }
  ],

  // Other Academic Activities (7 non-regular academic sessions)
  otherAcademicActivities: [
    { id: "ACT_01", title: "Placement", icon: "💼", description: "Campus placement training, mock interviews, and aptitude sessions" },
    { id: "ACT_02", title: "NPTEL", icon: "💻", description: "Online certification courses and self-paced video lectures" },
    { id: "ACT_03", title: "Library", icon: "📖", description: "Digital and physical library reference, journal reviews, and research" },
    { id: "ACT_04", title: "Group Discussion", icon: "🗣️", description: "Peer brainstorming, debate topics, and soft-skills enrichment" },
    { id: "ACT_05", title: "Club Activities", icon: "🎨", description: "Technical society and cultural club events and hackathons" },
    { id: "ACT_06", title: "Mentor", icon: "🤝", description: "One-on-one academic counseling and student guidance" },
    { id: "ACT_07", title: "HoD", icon: "🏛️", description: "Departmental meeting, reviews, and HoD interaction hour" }
  ],

  // Clean Production State (empty collections)
  faculty: null,
  students: [],
  assignments: [],
  submissions: []
};
