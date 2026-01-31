const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("school portal backend is running");
});

const PORT = process.env.PORT || 5000;

/* =======================
   ✅ CORS (v0.1)
   - Allows Authorization header
   - Restricts origins safely
======================= */
const allowedOrigins = [
  process.env.FRONTEND_URL,              // e.g. https://your-frontend.vercel.app
  process.env.FRONTEND_URL_2,            // optional second domain
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, cb) {
      // allow server-to-server and tools with no origin
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked origin: " + origin));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options(/.*/, cors());

app.use(express.json());

/* =======================
   ENV
======================= */
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key";
// ✅ v0.1: longer session to avoid random 401 after 1 hour
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://ridwanullah24:olarewaju@cluster0.s0b1kif.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error(err));

/* =======================
   SYSTEM CONFIG
======================= */
const configPath = path.join(__dirname, "systemConfig.json");

if (!fs.existsSync(configPath)) {
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        installed: false,
        schoolName: "",
        installedAt: null,
        productKey: "",
        licenseStatus: "inactive", // inactive | active | locked
        licenseExpiry: null,
      },
      null,
      2
    )
  );
}

/**
 * ✅ v0.1 rule:
 * - READS (GET) must work even if license is bad
 * - WRITES (POST/PUT/DELETE) are blocked when locked/expired
 */
const checkLicense = (req, res, next) => {
  // ✅ do not block reads in v0.1
  if (req.method === "GET") return next();

  try {
    const config = JSON.parse(fs.readFileSync(configPath));

    if (config.licenseStatus === "locked") {
      return res.status(403).json({
        message: "System locked. Please contact the vendor.",
        code: "LICENSE_LOCKED",
      });
    }

    if (config.licenseExpiry && new Date() > new Date(config.licenseExpiry)) {
      return res.status(403).json({
        message: "License expired. Please renew.",
        code: "LICENSE_EXPIRED",
      });
    }

    next();
  } catch {
    // ✅ do not block reads; but for writes, fail clearly
    return res.status(500).json({ message: "License check failed" });
  }
};

/* =======================
   SETUP ROUTES
======================= */
app.get("/api/setup/status", (req, res) => {
  const config = JSON.parse(fs.readFileSync(configPath));
  res.json({ installed: config.installed });
});

app.post("/api/setup", async (req, res) => {
  try {
    const { schoolName, adminUsername, adminPassword, productKey } = req.body;
    if (!schoolName || !adminUsername || !adminPassword || !productKey) {
      return res.status(400).json({ message: "All fields required" });
    }

    const config = JSON.parse(fs.readFileSync(configPath));
    if (config.installed) {
      return res.status(403).json({ message: "System already installed" });
    }

    if (!productKey.startsWith("BC-")) {
      return res.status(400).json({ message: "Invalid product key" });
    }

    const hashed = await bcrypt.hash(adminPassword, 10);

    await User.create({
      username: adminUsername,
      password: hashed,
      role: "Super Admin",
      type: "admin",
      isActivated: true,
      extraPermissions: [],
    });

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          installed: true,
          schoolName,
          productKey,
          installedAt: new Date().toISOString(),
          licenseStatus: "active",
          licenseExpiry: null,
        },
        null,
        2
      )
    );

    res.json({ message: "System setup completed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* =======================
   SCHEMAS / MODELS
======================= */
const genericSchema = (fields) =>
  new mongoose.Schema(
    {
      ...fields,
      timestamp: { type: Date, default: Date.now },
    },
    { timestamps: true }
  );

// Students: supports your frontend (admissionNo, classLevel -> mapped later)
const studentSchema = new mongoose.Schema({
  admissionNo: { type: String, unique: true, index: true },
  firstName: String,
  lastName: String,
  studentClass: String,
  gender: String,
  parentPhone: String,
  guardianName: String,
  address: String,
  status: String,
  dateOfBirth: String,
  photo: String,

  password: String,
  type: { type: String, default: "student" },
  role: { type: String, default: "Student" },
  isActivated: { type: Boolean, default: false },
  activatedAt: Date,
});

// Staff: add assignedClasses/assignedSubjects since timetable/results use it
const staffSchema = new mongoose.Schema({
  staffId: { type: String, unique: true, index: true },
  surname: String,
  firstname: String,
  role: String,

  assignedClasses: { type: [String], default: [] },
  assignedSubjects: { type: [String], default: [] },

  password: String,
  type: { type: String, default: "staff" },
  isActivated: { type: Boolean, default: false },
  activatedAt: Date,
});

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, index: true },
    password: String,
    role: String,
    type: String,
    isActivated: { type: Boolean, default: true },
    extraPermissions: [String],
  },
  { timestamps: true }
);

/**
 * ✅ v0.1 Attendance must be consistent (fixes reporting + duplicates)
 */
const attendanceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    class: { type: String, required: true, index: true },
    admissionNo: { type: String, required: true, index: true },
    status: { type: String, default: "Present" }, // Present | Absent | Late
    markedBy: String,

    session: { type: String, default: "" }, // "2025/2026"
    term: { type: String, default: "" },    // "Third Term"
  },
  { timestamps: true }
);

// prevent duplicates per day per student (per term/session if provided)
attendanceSchema.index(
  { date: 1, class: 1, admissionNo: 1, session: 1, term: 1 },
  { unique: true, sparse: true }
);

// ✅ v0.1 entities missing in your models map (frontend calls them)
const promotionSchema = genericSchema({
  studentId: String,     // admissionNo
  fromClass: String,
  toClass: String,
  session: String,       // "2025/2026"
  term: String,          // "Third Term"
  promotedBy: String,
  date: String,
  rolledBack: { type: Boolean, default: false },
});

const calendarEventSchema = genericSchema({
  title: String,
  date: String,
  time: String,
  location: String,
  note: String,
  audience: { type: String, default: "all" }, // all | students | staff
});

const certificationSchema = genericSchema({
  title: String,
  studentAdmissionNo: String,
  studentName: String,
  className: String,
  type: String,
  description: String,
  issuedDate: String,
  status: String,
  fileUrl: String,
});

const Student = mongoose.model("Student", studentSchema);
const Staff = mongoose.model("Staff", staffSchema);
const User = mongoose.model("User", userSchema);

const Subject = mongoose.model("Subject", genericSchema({}));
const Result = mongoose.model("Result", genericSchema({}));
const PendingResult = mongoose.model("PendingResult", genericSchema({}));
const FeeRecord = mongoose.model("FeeRecord", genericSchema({}));

// ✅ Use strict schema
const Attendance = mongoose.model("Attendance", attendanceSchema);

const Timetable = mongoose.model("Timetable", genericSchema({}));
const DigitalLibrary = mongoose.model("DigitalLibrary", genericSchema({}));
const AdminMessage = mongoose.model("AdminMessage", genericSchema({}));

// ✅ new
const Promotion = mongoose.model("Promotion", promotionSchema);
const CalendarEvent = mongoose.model("CalendarEvent", calendarEventSchema);
const Certification = mongoose.model("Certification", certificationSchema);

const models = {
  schoolPortalStudents: Student,
  schoolPortalStaff: Staff,
  schoolPortalUsers: User,
  schoolPortalSubjects: Subject,
  schoolPortalResults: Result,
  schoolPortalPendingResults: PendingResult,
  schoolPortalFeeRecords: FeeRecord,
  schoolPortalAttendance: Attendance,
  schoolPortalTimetables: Timetable,
  schoolPortalDigitalLibrary: DigitalLibrary,
  schoolPortalAdminMessages: AdminMessage,

  // ✅ add missing entities used by frontend
  schoolPortalPromotions: Promotion,
  schoolPortalCalendarEvents: CalendarEvent,
  schoolPortalCertifications: Certification,
};

/* =======================
   AUTH ROUTES
======================= */
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user =
      (await Student.findOne({ admissionNo: username })) ||
      (await Staff.findOne({ staffId: username })) ||
      (await User.findOne({ username }));

    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        type: user.type,
        // ✅ optional identifiers for frontend stability
        admissionNo: user.admissionNo,
        staffId: user.staffId,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const safeUser = user.toObject();
    delete safeUser.password;

    safeUser.needsActivation =
      (safeUser.type === "student" || safeUser.type === "staff") &&
      safeUser.isActivated === false;

    return res.json({ token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Login failed" });
  }
});

app.post("/api/activate-account", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user =
      (await Student.findOne({ admissionNo: username })) ||
      (await Staff.findOne({ staffId: username }));

    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = await bcrypt.hash(password, 10);
    user.isActivated = true;
    user.activatedAt = new Date();
    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        type: user.type,
        admissionNo: user.admissionNo,
        staffId: user.staffId,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const safeUser = user.toObject();
    delete safeUser.password;
    safeUser.needsActivation = false;

    return res.json({ message: "Account activated", token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Activation failed" });
  }
});

/* =======================
   JWT MIDDLEWARE
======================= */
const verifyToken = (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : null;

  if (!token) return res.status(403).json({ message: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      const msg =
        err.name === "TokenExpiredError"
          ? "Token expired"
          : "Invalid token";
      return res.status(401).json({ message: msg });
    }
    req.user = decoded;
    next();
  });
};

/* =======================
   PROTECTED ENTITY ROUTES
======================= */
app.use("/api/:entity", verifyToken, checkLicense);

/* =======================
   GENERIC CRUD (SAFE)
   ✅ deletes client _id/id to prevent local_ crash
   ✅ students/staff default password = 123 (hashed) if missing
======================= */
app.get("/api/:entity", async (req, res) => {
  const model = models[req.params.entity];
  if (!model) return res.status(404).json({ message: "Entity not found" });
  res.json(await model.find());
});

app.post("/api/:entity", async (req, res) => {
  try {
    const entity = req.params.entity;
    const model = models[entity];
    if (!model) return res.status(404).json({ message: "Entity not found" });

    const body = { ...req.body };

    // ✅ never accept client ids
    delete body._id;
    delete body.id;

    // ✅ map student fields from your StudentManagement UI
    if (entity === "schoolPortalStudents") {
      if (!body.studentClass && body.classLevel) body.studentClass = body.classLevel;
      if (!body.parentPhone && body.guardianPhone) body.parentPhone = body.guardianPhone;

      // if UI sent only name, split it
      if ((!body.firstName || !body.lastName) && body.name) {
        const parts = String(body.name).trim().split(/\s+/);
        body.firstName = parts.shift() || "";
        body.lastName = parts.join(" ") || "";
      }

      // ✅ default password 123
      if (!body.password) body.password = "123";
      body.password = await bcrypt.hash(String(body.password), 10);
      body.type = "student";
      if (body.isActivated === undefined) body.isActivated = false;
      if (!body.role) body.role = "Student";
    }

    // ✅ staff default password 123
    if (entity === "schoolPortalStaff") {
      if (!body.password) body.password = "123";
      body.password = await bcrypt.hash(String(body.password), 10);
      body.type = "staff";
      if (body.isActivated === undefined) body.isActivated = false;
    }

    // hash password for other entities only if provided
    if (
      entity !== "schoolPortalStudents" &&
      entity !== "schoolPortalStaff" &&
      body.password
    ) {
      body.password = await bcrypt.hash(String(body.password), 10);
    }

    const created = await model.create(body);
    return res.status(201).json(created);
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message, errors: err.errors });
    }
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Duplicate record", keyValue: err.keyValue });
    }
    return res.status(500).json({ message: err.message || "Create failed" });
  }
});

app.put("/api/:entity/:id", async (req, res) => {
  try {
    const entity = req.params.entity;
    const model = models[entity];
    if (!model) return res.status(404).json({ message: "Entity not found" });

    const body = { ...req.body };

    // map student updates too
    if (entity === "schoolPortalStudents") {
      if (!body.studentClass && body.classLevel) body.studentClass = body.classLevel;
      if (!body.parentPhone && body.guardianPhone) body.parentPhone = body.guardianPhone;

      if ((!body.firstName || !body.lastName) && body.name) {
        const parts = String(body.name).trim().split(/\s+/);
        body.firstName = parts.shift() || "";
        body.lastName = parts.join(" ") || "";
      }
    }

    if (body.password) body.password = await bcrypt.hash(String(body.password), 10);

    const updated = await model.findByIdAndUpdate(req.params.id, body, { new: true });
    return res.json(updated);
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message, errors: err.errors });
    }
    return res.status(500).json({ message: err.message || "Update failed" });
  }
});

app.delete("/api/:entity/:id", async (req, res) => {
  const model = models[req.params.entity];
  if (!model) return res.status(404).json({ message: "Entity not found" });
  await model.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
