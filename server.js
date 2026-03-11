const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const JWT_SECRET = process.env.JWT_SECRET || "studybuddy-secret-key-2024";
const MONGO_URI = process.env.MONGO_URI;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// ── CONNECT MONGODB ──
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err.message));

// ── SCHEMAS ──
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const timetableSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  subject:   { type: String, required: true },
  type:      { type: String, enum: ["weekly", "specific"], required: true },
  days:      [{ type: String }],        // for weekly: ["Monday","Wednesday"]
  time:      { type: String, required: true }, // "14:30"
  date:      { type: String },          // for specific: "2024-12-25"
  active:    { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const User      = mongoose.model("User", userSchema);
const Timetable = mongoose.model("Timetable", timetableSchema);

// ── AUTH MIDDLEWARE ──
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── AUTH ROUTES ──
app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: "All fields are required" });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashed });
    const token = jwt.sign({ id: user._id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ error: "No account found with this email" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ error: "Incorrect password" });

    const token = jwt.sign({ id: user._id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CHAT ROUTE ──
app.post("/api/chat", authMiddleware, async (req, res) => {
  try {
    const { messages } = req.body;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        system: `You are StudyBuddy, a friendly and encouraging AI homework helper for students of all ages.
- Explain concepts in clear simple language like explaining to a curious 12-year-old
- Use relatable analogies and real-world examples
- Be warm and encouraging
- Break complex topics into digestible steps
- For practice questions provide 3 questions then show "📋 Answers:" at the end
- Keep explanations concise 150-300 words
- Lead with a clear direct answer expand with examples end encouragingly`,
        messages,
      }),
    });
    const data = await response.json();
    if (data.error) console.error("Anthropic error:", data.error.message);
    res.json(data);
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── TIMETABLE ROUTES ──
app.get("/api/timetable", authMiddleware, async (req, res) => {
  try {
    const entries = await Timetable.find({ userId: req.user.id, active: true }).sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/timetable", authMiddleware, async (req, res) => {
  try {
    const { subject, type, days, time, date } = req.body;
    if (!subject || !type || !time)
      return res.status(400).json({ error: "Subject, type and time are required" });
    if (type === "weekly" && (!days || days.length === 0))
      return res.status(400).json({ error: "Select at least one day" });
    if (type === "specific" && !date)
      return res.status(400).json({ error: "Date is required for specific schedule" });

    const entry = await Timetable.create({ userId: req.user.id, subject, type, days, time, date });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/timetable/:id", authMiddleware, async (req, res) => {
  try {
    await Timetable.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}); 

// ── SERVE PAGES ──
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/app", (req, res) => res.sendFile(path.join(__dirname, "public", "app.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ StudyBuddy v2 running on port ${PORT}`));
