// backend/data.js

const students = [
  {
    id: '66a50b719ed0847053e1a052',
    admissionNo: 'BAC/STD/2025/0001',
    firstName: 'John',
    lastName: 'Doe',
    dob: '2010-05-15',
    parentName: 'Jane Doe',
    parentPhone: '08012345678',
    studentClass: 'JSS1',
    gender: 'Male',
    address: '123 School Road, Lagos',
    enrollmentDate: '2025-01-10',
    medicalNotes: '',
    admissionDocument: 'john_doe_admission.pdf',
    password: '123',
    type: 'student',
    username: 'BAC/STD/2025/0001'
  },
  {
    id: '66a50b719ed0847053e1a053',
    admissionNo: 'BAC/STD/2025/0002',
    firstName: 'Aisha',
    lastName: 'Aliyu',
    dob: '2010-08-20',
    parentName: 'Musa Aliyu',
    parentPhone: '08023456789',
    studentClass: 'JSS1',
    gender: 'Female',
    address: '456 Kano Street, Abuja',
    enrollmentDate: '2025-01-10',
    medicalNotes: '',
    admissionDocument: 'aisha_aliyu_admission.pdf',
    password: '123',
    type: 'student',
    username: 'BAC/STD/2025/0002'
  }
];

const staffs = [
  {
    id: '66a50b719ed0847053e1a054',
    staffId: 'STAFF/2025/0001',
    surname: 'Smith',
    firstname: 'David',
    role: 'Teacher',
    gender: 'Male',
    dateOfEmployment: '2024-09-01',
    department: 'Science',
    qualifications: 'B.Sc. Biology',
    contactEmail: 'david.smith@school.com',
    contactPhone: '08098765432',
    resumeDocument: 'david_smith_cv.pdf',
    assignedSubjects: ['BIO101'],
    assignedClasses: ['JSS1', 'SS2'],
    password: '123',
    type: 'staff',
    username: 'STAFF/2025/0001'
  },
  {
    id: '66a50b719ed0847053e1a055',
    staffId: 'STAFF/2025/0002',
    surname: 'Chukwuma',
    firstname: 'Ada',
    role: 'Admin',
    gender: 'Female',
    dateOfEmployment: '2023-05-20',
    department: 'Administration',
    qualifications: 'M.Sc. Admin',
    contactEmail: 'ada.c@school.com',
    contactPhone: '08033445566',
    resumeDocument: 'ada_chukwuma_cv.pdf',
    assignedSubjects: [],
    assignedClasses: [],
    password: '123',
    type: 'admin',
    username: 'admin'
  }
];

const subjects = [
  {
    id: '66a50b719ed0847053e1a056',
    subjectCode: 'MATH101',
    subjectName: 'Mathematics',
  },
  {
    id: '66a50b719ed0847053e1a057',
    subjectCode: 'ENG101',
    subjectName: 'English Language',
  },
  {
    id: '66a50b719ed0847053e1a058',
    subjectCode: 'BIO101',
    subjectName: 'Biology',
  }
];

const results = [];
const pendingResults = [];
const certificationResults = [];
const feeRecords = [];
const calendarEvents = [];
const syllabusEntries = [];
const digitalLibrary = [];
const users = [
  {
    id: '66a50b719ed0847053e1a059',
    username: 'admin',
    password: '123',
    role: 'Super Admin',
    type: 'admin'
  }
];
const adminMessages = [];

// Combine all your data into a single object to be exported
module.exports = {
  students,
  staffs,
  subjects,
  results,
  pendingResults,
  certificationResults,
  feeRecords,
  calendarEvents,
  syllabusEntries,
  digitalLibrary,
  users,
  adminMessages
};