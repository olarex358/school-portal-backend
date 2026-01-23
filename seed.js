const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const data = require('./data');

// ⚠️ MOVE TO .env LATER
const MONGO_URI =
  'mongodb+srv://ridwanullah24:olarewaju@cluster0.s0b1kif.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// ❗ SAFETY CHECK
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Seeding is blocked in production');
  process.exit(1);
}

/* =======================
   SCHEMAS (MATCH server.js)
======================= */

const studentSchema = new mongoose.Schema({
  admissionNo: { type: String, required: true, unique: true },
  firstName: String,
  lastName: String,
  dob: String,
  parentName: String,
  parentPhone: String,
  studentClass: String,
  gender: String,
  address: String,
  enrollmentDate: String,
  medicalNotes: String,
  admissionDocument: String,
  password: { type: String, required: true },
  type: { type: String, default: 'student' },
  username: String
});

const staffSchema = new mongoose.Schema({
  staffId: { type: String, required: true, unique: true },
  surname: String,
  firstname: String,
  role: String,
  gender: String,
  dateOfEmployment: String,
  department: String,
  qualifications: String,
  contactEmail: String,
  contactPhone: String,
  resumeDocument: String,
  assignedSubjects: [String],
  assignedClasses: [String],
  password: { type: String, required: true },
  type: { type: String, default: 'staff' },
  username: String
});

const subjectSchema = new mongoose.Schema({
  subjectCode: { type: String, required: true, unique: true },
  subjectName: String
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: String,
  type: { type: String, default: 'user' }
});

/* =======================
   MODELS
======================= */

const Student = mongoose.model('Student', studentSchema);
const Staff = mongoose.model('Staff', staffSchema);
const Subject = mongoose.model('Subject', subjectSchema);
const User = mongoose.model('User', userSchema);

/* =======================
   SEED FUNCTION
======================= */

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected (seeding)');

    // 🧹 CLEAR ONLY DEV DATA
    await Promise.all([
      Student.deleteMany({}),
      Staff.deleteMany({}),
      Subject.deleteMany({}),
      User.deleteMany({})
    ]);

    // 🔐 HASH PASSWORDS
    for (const s of data.students) {
      s.password = await bcrypt.hash(s.password, 10);
      s.username = s.admissionNo;
    }

    for (const s of data.staffs) {
      s.password = await bcrypt.hash(s.password, 10);
      s.username = s.staffId;
    }

    for (const u of data.users) {
      u.password = await bcrypt.hash(u.password, 10);
    }

    await Student.insertMany(data.students);
    await Staff.insertMany(data.staffs);
    await Subject.insertMany(data.subjects);
    await User.insertMany(data.users);

    console.log('✅ Database seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
