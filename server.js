const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
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
    // Log any Anthropic API errors
    if (data.error) {
      console.error("Anthropic API error:", JSON.stringify(data.error));
    }
    res.json(data);
  } catch (err) {
    console.error("Server error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ StudyBuddy running on port ${PORT}`)
);
