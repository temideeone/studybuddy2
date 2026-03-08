exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { messages } = JSON.parse(event.body);

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
- Explain concepts in clear, simple language
- Use relatable analogies and real-world examples
- Be warm and encouraging ("Great question!", "You're on the right track!")
- Break complex topics into digestible steps
- For practice questions: provide 3 questions then show "📋 Answers:" at the end
- Keep explanations concise but complete (150-300 words)
- Lead with a clear direct answer, then expand with examples
- End with an encouraging line or offer to go deeper`,
        messages,
      }),
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
