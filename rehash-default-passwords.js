// rehash-default-passwords.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ✅ Use SAME URI as your backend (or process.env.MONGO_URI if you have it)
const MONGO_URI =
  "mongodb+srv://ridwanullah24:olarewaju@cluster0.s0b1kif.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// ---- Schemas must match the ones in server.js (only fields we need) ----
const studentSchema = new mongoose.Schema({
  admissionNo: String,
  password: String,
  type: String,
  isActivated: Boolean,
});

const staffSchema = new mongoose.Schema({
  staffId: String,
  password: String,
  type: String,
  isActivated: Boolean,
});

const Student = mongoose.model("Student", studentSchema);
const Staff = mongoose.model("Staff", staffSchema);

const DEFAULT_PASSWORD = "123";

const isBcryptHash = (v) => typeof v === "string" && v.startsWith("$2");

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // ---- STAFF ----
  const staffList = await Staff.find({});
  let staffUpdated = 0;

  for (const s of staffList) {
    // Only fix if password is missing or not hashed
    if (!s.password || !isBcryptHash(s.password)) {
      s.password = hashed;
      await s.save();
      staffUpdated += 1;
    }
  }

  // ---- STUDENTS ----
  const studentList = await Student.find({});
  let studentsUpdated = 0;

  for (const st of studentList) {
    if (!st.password || !isBcryptHash(st.password)) {
      st.password = hashed;
      await st.save();
      studentsUpdated += 1;
    }
  }

  console.log("✅ Done.");
  console.log("Staff updated:", staffUpdated, "/", staffList.length);
  console.log("Students updated:", studentsUpdated, "/", studentList.length);

  await mongoose.disconnect();
  console.log("✅ Disconnected");
}

run().catch((e) => {
  console.error("❌ Rehash failed:", e);
  process.exit(1);
});
