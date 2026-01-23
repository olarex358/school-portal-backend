/* =======================
   CORE IMPORTS
======================= */
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();
app.get("/",(re,res)=>{res.status(200).send("school portal backend is running");
});
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

/* =======================
   ENV (MOVE TO .env LATER)
======================= */
const JWT_SECRET = "your_super_secret_key";
const MONGO_URI =
  "mongodb+srv://ridwanullah24:olarewaju@cluster0.s0b1kif.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

/* =======================
   DB CONNECTION
======================= */
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error(err));

/* =======================
   SYSTEM CONFIG (SETUP)
======================= */
const configPath = path.join(__dirname, "systemConfig.json");
const checkLicense = (req, res, next) => {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));

    // 🔒 Hard lock
    if (config.licenseStatus === "locked") {
      return res.status(403).json({
        message: "System locked. Please contact the vendor.",
        code: "LICENSE_LOCKED",
      });
    }

    // ⏰ Expiry lock
    if (
      config.licenseExpiry &&
      new Date() > new Date(config.licenseExpiry)
    ) {
      return res.status(403).json({
        message: "License expired. Please renew.",
        code: "LICENSE_EXPIRED",
      });
    }

    // ✅ Active license
    next();
  } catch (err) {
    return res.status(500).json({
      message: "License check failed",
    });
  }
};

if (!fs.existsSync(configPath)) {
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        installed: false,
        schoolName: "",
        installedAt: null,
        productKey: "",
      },
      null,
      2
    )
  );
}

/* =======================
   PUBLIC SETUP ROUTES
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
    if (config.installed)
      return res.status(403).json({ message: "System already installed" });

    if (!productKey.startsWith("BC-"))
      return res.status(400).json({ message: "Invalid product key" });

    const hashed = await bcrypt.hash(adminPassword, 10);

    await User.create({
      username: adminUsername,
      password: hashed,
      role: "admin",
      type: "admin",
    });

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          installed: true,
          schoolName,
          productKey,
          installedAt: new Date().toISOString(),
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
   SCHEMAS
======================= */
const genericSchema = fields =>
  new mongoose.Schema({
    ...fields,
    timestamp: { type: Date, default: Date.now },
  });

const studentSchema = new mongoose.Schema({
  admissionNo: { type: String, unique: true }, // BC/STD/...
  firstName: String,
  lastName: String,
  studentClass: String,
  gender: String,
  parentPhone: String,
  password: String,
  type: { type: String, default: "student" },
  isActivated: { type: Boolean, default: false },
  activatedAt: Date,
});

const staffSchema = new mongoose.Schema({
  staffId: { type: String, unique: true },
  surname: String,
  firstname: String,
  role: String,
  password: String,
  type: { type: String, default: "staff" },
  isActivated: { type: Boolean, default: false },
  activatedAt: Date,
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  type: String,
});

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
   AUTH ROUTES (PUBLIC)
======================= */
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const user =
    (await Student.findOne({ admissionNo: username })) ||
    (await Staff.findOne({ staffId: username })) ||
    (await User.findOne({ username }));

  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: "Invalid credentials" });

  if (
    (user.type === "student" || user.type === "staff") &&
    !user.isActivated
  ) {
    return res.json({
      needsActivation: true,
      username: user.admissionNo || user.staffId,
      userType: user.type,
    });
  }

  const token = jwt.sign(
    { id: user._id, role: user.role, type: user.type },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const { password: _, ...safeUser } = user.toObject();
  res.json({ token, user: safeUser });
});

app.post("/api/activate-account", async (req, res) => {
  const { username, password } = req.body;

  const user =
    (await Student.findOne({ admissionNo: username })) ||
    (await Staff.findOne({ staffId: username }));

  if (!user) return res.status(404).json({ message: "User not found" });

  user.password = await bcrypt.hash(password, 10);
  user.isActivated = true;
  user.activatedAt = new Date();
  await user.save();

  res.json({ message: "Account activated" });
});

/* =======================
   JWT MIDDLEWARE
======================= */
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ message: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid token" });
    req.user = decoded;
    next();
  });
};

/* =======================
   PASSWORD CHANGE
======================= */
app.post("/api/change-password", async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;

  const user =
    (await Student.findById(userId)) ||
    (await Staff.findById(userId)) ||
    (await User.findById(userId));

  if (!user) return res.status(404).json({ message: "User not found" });

  if (!(await bcrypt.compare(oldPassword, user.password)))
    return res.status(401).json({ message: "Old password incorrect" });

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ message: "Password changed successfully" });
});

/* =======================
   PROTECTED ROUTES
======================= */
app.use("/api/:entity", verifyToken, checkLicense);
// 🔑 LICENSE ACTIVATE / RENEW (ADMIN ONLY)
app.post("/api/license/activate", verifyToken, async (req, res) => {
  try {
    // Only admin can activate license
    if (req.user.type !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { productKey, durationInDays } = req.body;

    if (!productKey || !durationInDays) {
      return res.status(400).json({ message: "Missing fields" });
    }

    // Basic product key rule (you control this)
    if (!productKey.startsWith("BC-")) {
      return res.status(400).json({ message: "Invalid product key" });
    }

    const config = JSON.parse(fs.readFileSync(configPath));

    // Calculate expiry
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + Number(durationInDays));

    // Update license
    const updatedConfig = {
      ...config,
      productKey,
      licenseStatus: "active",
      licenseExpiry: expiryDate.toISOString(),
    };

    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));

    res.json({
      message: "License activated successfully",
      licenseExpiry: updatedConfig.licenseExpiry,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* =======================
   GENERIC CRUD
======================= */
app.get("/api/:entity", async (req, res) => {
  const model = models[req.params.entity];
  if (!model) return res.status(404).json({ message: "Entity not found" });
  res.json(await model.find());
});

app.post("/api/:entity", async (req, res) => {
  const model = models[req.params.entity];
  if (!model) return res.status(404).json({ message: "Entity not found" });
  res.status(201).json(await model.create(req.body));
});

app.put("/api/:entity/:id", async (req, res) => {
  const model = models[req.params.entity];
  if (!model) return res.status(404).json({ message: "Entity not found" });
  res.json(await model.findByIdAndUpdate(req.params.id, req.body, { new: true }));
});

app.delete("/api/:entity/:id", async (req, res) => {
  const model = models[req.params.entity];
  if (!model) return res.status(404).json({ message: "Entity not found" });
  await model.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});
// 🔍 GET LICENSE STATUS (ADMIN VIEW)
app.get("/api/license/status", verifyToken, (req, res) => {
  if (req.user.type !== "admin") {
    return res.status(403).json({ message: "Unauthorized" });
  }

  const config = JSON.parse(fs.readFileSync(configPath));

  res.json({
    licenseStatus: config.licenseStatus,
    licenseExpiry: config.licenseExpiry,
    productKey: config.productKey,
  });
});
// =======================
// SERVE FRONTEND (REACT)
// =======================
//const buildPath = path.join(__dirname, "build");

//app.use(express.static(buildPath));

//app.get('*', (req, res) => {
  //res.sendFile(path.join(__dirname, 'build', 'index.html'));
//});

/* =======================
   SERVER START
======================= */
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
