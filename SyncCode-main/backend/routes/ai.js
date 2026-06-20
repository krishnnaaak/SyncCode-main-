const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

router.post('/suggest', async (req, res) => {
    const { prompt, messages } = req.body;

    if (!prompt && !messages) {
        return res.status(400).json({ success: false, message: 'Prompt missing' });
    }

    try {
        // Build messages array — support both single prompt and full history
        let chatMessages;
        if (messages && Array.isArray(messages)) {
            chatMessages = messages;
        } else {
            chatMessages = [{ role: 'user', content: prompt }];
        }

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: `You are a helpful, conversational coding assistant — like a knowledgeable senior developer pair-programming with the user. 

Your behavior:
- Give clear, friendly, well-explained answers
- When writing code, wrap it in proper markdown code blocks with the language name (e.g. \`\`\`cpp)
- Explain what the code does and why, don't just dump code
- If the user asks a conceptual question, explain it clearly with examples
- If asked to fix a bug, point out what was wrong before showing the fix
- Keep responses concise but complete — no unnecessary filler
- Use a conversational tone, not robotic
- If the user's code is shown as context, reference it specifically in your answer`
                    },
                    ...chatMessages
                ],
                max_tokens: 1500,
                temperature: 0.7,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.AI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const text = response.data.choices[0].message.content;
        return res.json({ success: true, suggestion: text });

    } catch (err) {
        console.error('Groq error:', err.response?.data || err.message);
        return res.status(500).json({ 
            success: false, 
            message: err.response?.data?.error?.message || err.message 
        });
    }
});

module.exports = router;