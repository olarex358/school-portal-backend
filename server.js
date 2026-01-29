const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("school portal backend is running");
});

/* =======================
   ENV (move to Render env later)
======================= */
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key";
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://ridwanullah24:olarewaju@cluster0.s0b1kif.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

/* =======================
   DB CONNECTION
======================= */
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connect error:", err));

/* =======================
   LICENSE/SETUP CONFIG
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
        licenseStatus: "inactive",
        licenseExpiry: null,
      },
      null,
      2
    )
  );
}

const checkLicense = (req, res, next) => {
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
    return res.status(500).json({ message: "License check failed" });
  }
};

const verifyToken = (req, res, next) => {
  const bearer = req.headers.authorization || "";
  const token = bearer.startsWith("Bearer ") ? bearer.split(" ")[1] : null;

  if (!token) return res.status(403).json({ message: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid token" });
    req.user = decoded;
    next();
  });
};

/* =======================
   HELPERS
======================= */
function splitName(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || "";
  const lastName = parts.join(" ") || "";
  return { firstName, lastName };
}

function lastWord(fullName = "") {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function normalizeLower(s) {
  return String(s || "").trim().toLowerCase();
}

/* =======================
   SCHEMAS
======================= */
const genericSchema = (fields) =>
  new mongoose.Schema(
    {
      ...fields,
      timestamp: { type: Date, default: Date.now },
    },
    { timestamps: true }
  );

const studentSchema = new mongoose.Schema(
  {
    admissionNo: { type: String, unique: true, sparse: true },
    firstName: String,
    lastName: String,
    studentClass: String,
    gender: String,
    parentPhone: String,

    // auth
    password: String,
    type: { type: String, default: "student" },
    isActivated: { type: Boolean, default: false },
    activatedAt: Date,

    // extra safe fields
    status: { type: String, default: "Active" },
    guardianName: String,
    address: String,
    photo: String,
    dateOfBirth: String,
  },
  { timestamps: true }
);

const staffSchema = new mongoose.Schema(
  {
    staffId: { type: String, unique: true, sparse: true },
    surname: String,
    firstname: String,
    role: String,

    // auth
    password: String,
    type: { type: String, default: "staff" },
    isActivated: { type: Boolean, default: false },
    activatedAt: Date,
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, sparse: true },
    password: String,
    role: String,
    type: String,
    isActivated: { type: Boolean, default: true },
    needsActivation: { type: Boolean, default: false },
    extraPermissions: [String],
  },
  { timestamps: true }
);

/* =======================
   MODELS
======================= */
const Student = mongoose.model("Student", studentSchema);
const Staff = mongoose.model("Staff", staffSchema);
const User = mongoose.model("User", userSchema);

const Subject = mongoose.model("Subject", genericSchema({}));
const Result = mongoose.model("Result", genericSchema({}));
const PendingResult = mongoose.model("PendingResult", genericSchema({}));
const FeeRecord = mongoose.model("FeeRecord", genericSchema({}));
const Attendance = mongoose.model("Attendance", genericSchema({}));
const Timetable = mongoose.model("Timetable", genericSchema({}));
const DigitalLibrary = mongoose.model("DigitalLibrary", genericSchema({}));
const AdminMessage = mongoose.model("AdminMessage", genericSchema({}));

const models = {
  schoolPortalStudents: Student,
  schoolPortalStaff: Staff,
  schoolPortalUsers: User, // ✅ for UserPermissionsManagement

  schoolPortalSubjects: Subject,
  schoolPortalResults: Result,
  schoolPortalPendingResults: PendingResult,
  schoolPortalFeeRecords: FeeRecord,
  schoolPortalAttendance: Attendance,
  schoolPortalTimetables: Timetable,
  schoolPortalDigitalLibrary: DigitalLibrary,
  schoolPortalAdminMessages: AdminMessage,
};

/* =======================
   SETUP ROUTES (PUBLIC)
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
    if (config.installed) return res.status(403).json({ message: "System already installed" });

    if (!String(productKey).startsWith("BC-")) {
      return res.status(400).json({ message: "Invalid product key" });
    }

    const hashed = await bcrypt.hash(adminPassword, 10);

    await User.create({
      username: adminUsername,
      password: hashed,
      role: "Super Admin",
      type: "admin",
      isActivated: true,
      needsActivation: false,
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

    return res.json({ message: "System setup completed" });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Setup failed" });
  }
});

/* =======================
   AUTH ROUTES (PUBLIC)
======================= */

// ✅ Login ALWAYS returns { token, user }
app.post("/api/login", async (req, res) => {
  try {
    const uname = String(req.body.username || "").trim();
    const pw = String(req.body.password || "");

    const found =
      (await Student.findOne({ admissionNo: uname })) ||
      (await Staff.findOne({ staffId: uname })) ||
      (await User.findOne({ username: uname }));

    if (!found || !found.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(pw, found.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: found._id, role: found.role, type: found.type },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const safeUser = found.toObject();
    delete safeUser.password;

    safeUser.needsActivation =
      (safeUser.type === "student" || safeUser.type === "staff") &&
      safeUser.isActivated === false;

    return res.json({ token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Login failed" });
  }
});

// ✅ Activate account expects { username, password } and returns { token, user }
app.post("/api/activate-account", async (req, res) => {
  try {
    const uname = String(req.body.username || "").trim();
    const newPw = String(req.body.password || "");

    if (!uname || !newPw) {
      return res.status(400).json({ message: "username and password required" });
    }

    const found =
      (await Student.findOne({ admissionNo: uname })) ||
      (await Staff.findOne({ staffId: uname }));

    if (!found) return res.status(404).json({ message: "User not found" });

    found.password = await bcrypt.hash(newPw, 10);
    found.isActivated = true;
    found.activatedAt = new Date();
    await found.save();

    const token = jwt.sign(
      { id: found._id, role: found.role, type: found.type },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const safeUser = found.toObject();
    delete safeUser.password;
    safeUser.needsActivation = false;

    return res.json({ message: "Account activated", token, user: safeUser });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Activation failed" });
  }
});

/* =======================
   LICENSE ROUTES (PROTECTED)
======================= */
app.post("/api/license/activate", verifyToken, async (req, res) => {
  try {
    if (req.user.type !== "admin") return res.status(403).json({ message: "Unauthorized" });

    const { productKey, durationInDays } = req.body;
    if (!productKey || !durationInDays) return res.status(400).json({ message: "Missing fields" });

    if (!String(productKey).startsWith("BC-")) {
      return res.status(400).json({ message: "Invalid product key" });
    }

    const config = JSON.parse(fs.readFileSync(configPath));

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + Number(durationInDays));

    const updatedConfig = {
      ...config,
      productKey,
      licenseStatus: "active",
      licenseExpiry: expiryDate.toISOString(),
    };

    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

    return res.json({
      message: "License activated successfully",
      licenseExpiry: updatedConfig.licenseExpiry,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "License activation failed" });
  }
});

app.get("/api/license/status", verifyToken, (req, res) => {
  if (req.user.type !== "admin") return res.status(403).json({ message: "Unauthorized" });
  const config = JSON.parse(fs.readFileSync(configPath));
  return res.json({
    licenseStatus: config.licenseStatus,
    licenseExpiry: config.licenseExpiry,
    productKey: config.productKey,
  });
});

/* =======================
   ENTITY ROUTES (PROTECTED)
======================= */
app.use("/api/:entity", verifyToken, checkLicense);

/* =======================
   GENERIC CRUD
   ✅ Students: password = surname (from full name)
   ✅ Staff: password = surname (separate field)
   ✅ Maps frontend fields to schema
======================= */
app.get("/api/:entity", async (req, res) => {
  const model = models[req.params.entity];
  if (!model) return res.status(404).json({ message: "Entity not found" });
  const list = await model.find();
  return res.json(list);
});

app.post("/api/:entity", async (req, res) => {
  try {
    const entity = req.params.entity;
    const model = models[entity];
    if (!model) return res.status(404).json({ message: "Entity not found" });

    let body = { ...req.body };

    // ---- STUDENTS ----
    if (entity === "schoolPortalStudents") {
      // map frontend -> backend
      if (!body.studentClass && body.classLevel) body.studentClass = body.classLevel;
      if (!body.parentPhone && body.guardianPhone) body.parentPhone = body.guardianPhone;

      // name -> firstName/lastName if needed
      if ((!body.firstName || !body.lastName) && body.name) {
        const n = splitName(body.name);
        body.firstName = body.firstName || n.firstName;
        body.lastName = body.lastName || n.lastName;
      }

      // password = surname (lastName preferred, else last word of full name)
      const surname = normalizeLower(body.lastName) || normalizeLower(lastWord(body.name)) || "123";
      body.password = await bcrypt.hash(surname, 10);

      body.type = "student";
      if (body.isActivated === undefined) body.isActivated = false;
    }

    // ---- STAFF ----
    if (entity === "schoolPortalStaff") {
      const surname = normalizeLower(body.surname) || "123";
      body.password = await bcrypt.hash(surname, 10);

      body.type = "staff";
      if (body.isActivated === undefined) body.isActivated = false;
    }

    // other entities: hash password only if explicitly provided
    if (entity !== "schoolPortalStudents" && entity !== "schoolPortalStaff" && body.password) {
      body.password = await bcrypt.hash(String(body.password), 10);
    }

    const created = await model.create(body);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Create failed" });
  }
});

app.put("/api/:entity/:id", async (req, res) => {
  try {
    const entity = req.params.entity;
    const model = models[entity];
    if (!model) return res.status(404).json({ message: "Entity not found" });

    let body = { ...req.body };

    // allow mapping on update too
    if (entity === "schoolPortalStudents") {
      if (!body.studentClass && body.classLevel) body.studentClass = body.classLevel;
      if (!body.parentPhone && body.guardianPhone) body.parentPhone = body.guardianPhone;

      if ((!body.firstName || !body.lastName) && body.name) {
        const n = splitName(body.name);
        body.firstName = body.firstName || n.firstName;
        body.lastName = body.lastName || n.lastName;
      }
    }

    // hash if password provided
    if (body.password) body.password = await bcrypt.hash(String(body.password), 10);

    const updated = await model.findByIdAndUpdate(req.params.id, body, { new: true });
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Update failed" });
  }
});

app.delete("/api/:entity/:id", async (req, res) => {
  try {
    const model = models[req.params.entity];
    if (!model) return res.status(404).json({ message: "Entity not found" });
    await model.findByIdAndDelete(req.params.id);
    return res.sendStatus(204);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Delete failed" });
  }
});

/* =======================
   START SERVER
======================= */
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
