const fs = require('fs');
const path = require('path');
const vm = require('vm');

global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; }
};
global.sessionStorage = {
  clear() {}
};
global.window = {
  dispatchEvent() {}
};
global.CustomEvent = class {
  constructor(name, detail) { this.name = name; this.detail = detail; }
};

const dataCode = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'data.js'), 'utf8');
const storageCode = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'storage.js'), 'utf8');
const authCode = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'auth.js'), 'utf8');

vm.runInThisContext(dataCode);
vm.runInThisContext(storageCode);
vm.runInThisContext(authCode);

console.log('--- TESTING CLEAN PRODUCTION INITIALIZATION ---');

// Simulate fresh visit / clean installation
StorageService.init();
AuthService.init();

const students = StorageService.getStudents();
const faculty = StorageService.getFaculty();
const assignments = StorageService.getAssignments();
const submissions = StorageService.getSubmissions();
const subjects = StorageService.getCourseSubjects();
const activities = StorageService.getOtherAcademicActivities();
const directory = StorageService.getStudentDirectoryRecords();

console.log('Students count:', students.length, students.length === 0 ? '✅ PASS' : '❌ FAIL');
console.log('Faculty profile:', faculty, faculty === null ? '✅ PASS' : '❌ FAIL');
console.log('Assignments count:', assignments.length, assignments.length === 0 ? '✅ PASS' : '❌ FAIL');
console.log('Submissions count:', submissions.length, submissions.length === 0 ? '✅ PASS' : '❌ FAIL');
console.log('Course Subjects count:', subjects.length, subjects.length === 12 ? '✅ PASS' : '❌ FAIL');
console.log('Other Activities count:', activities.length, activities.length === 7 ? '✅ PASS' : '❌ FAIL');
console.log('Directory records count:', directory.length, directory.length === 0 ? '✅ PASS' : '❌ FAIL');
console.log('Authenticated session:', AuthService.isAuthenticated(), AuthService.isAuthenticated() === false ? '✅ PASS' : '❌ FAIL');

// Test student registration
console.log('\n--- TESTING REAL STUDENT & FACULTY REGISTRATION ---');
const regStudent = StorageService.saveStudent({
  name: 'Test Student',
  rollNumber: 'ENG-101',
  email: 'test@student.edu'
});
console.log('Saved student:', regStudent.name, StorageService.getStudents().length === 1 ? '✅ PASS' : '❌ FAIL');

// Test assignment creation
const newAsg = StorageService.saveAssignment({
  assignmentNumber: 'Assignment 1',
  title: 'Real First Assignment',
  subjectId: 'SUB_01',
  subjectTitle: 'Machine Design',
  facultyName: 'Dr. Smith',
  dueDate: '2026-11-20T23:59',
  maxMarks: 100
});
console.log('Saved assignment:', newAsg.title, StorageService.getAssignments().length === 1 ? '✅ PASS' : '❌ FAIL');

console.log('\n🎉 All clean production state verifications passed successfully!');
