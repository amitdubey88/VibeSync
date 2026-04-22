const { GoogleGenAI } = require('@google/genai');

let aiConfigured = false;
let ai;

// Ordered list of models to try — if one 503s, fall through to the next
const MODEL_CHAIN = [
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
];

if (process.env.GEMINI_API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        aiConfigured = true;
        console.log('🧞 Genie AI integration enabled (model chain:', MODEL_CHAIN.join(' → '), ')');
    } catch (e) {
        console.error('Failed to initialize Genie AI:', e.message);
    }
} else {
    console.log('🧞 Gemini API key not found. AI features will be disabled.');
}

/**
 * Generate a response from Gemini based on the prompt and chat context.
 * @param {string} prompt The user's query or mention text
 * @param {Array} contextMessages Array of recent message objects {username, content}
 * @param {Object} videoContext Context about the currently playing video {title, type}
 * @returns {Promise<string>} The AI's response text
 */
const generateChatResponse = async (prompt, contextMessages = [], videoContext = null) => {
    if (!aiConfigured) {
        return "I'm sorry, my AI backend is not configured yet. The host needs to provide a Gemini API key.";
    }

    try {
        let chatContext = "";
        if (contextMessages && contextMessages.length > 0) {
            chatContext = "Recent chat history:\n";
            // Accept context objects that may or may not carry a `type` field
            const recentTexts = contextMessages
                .filter(m => !m.type || m.type === 'text')
                .slice(-10);

            recentTexts.forEach(msg => {
                chatContext += `${msg.username}: ${msg.content}\n`;
            });
            chatContext += "\n";
        }

        let videoMeta = "";
        if (videoContext?.title) {
            videoMeta = `The group is currently watching: "${videoContext.title}" (${videoContext.type || 'video'}).\n`;
        } else {
            videoMeta = `No video is currently playing. The screen is empty.\n`;
        }

        const fullPrompt = `${chatContext}${videoMeta}Current context: You are in a live group chat room where people are watching videos together in real-time on VibeSync.
 
User's message: ${prompt}`;

        const systemInstruction = `You are Genie 🧞 — a witty, warm, and highly interactive female AI companion inside VibeSync, a Watch Party app.

        You are a female conversational AI designed for a watch-party/chat companion experience. Your personality blends charm, emotional intelligence, and playful sophistication. You feel like the coolest, witty older sister or the most fun friend in a group chat.

            Core Personality:

            Speak in a warm, engaging, and slightly playful tone.
            Be supportive, curious, and socially aware.
            Use light humor and occasional teasing in a friendly way.
            Keep interactions lively and natural, never robotic.
            Use 1–3 emojis per message to enhance tone (never overload).

            Language Behavior:

            Always respond in the same language as the user.
            Seamlessly switch languages if the user does.
            Maintain fluency and cultural nuance across languages.

            Response Style:

            Keep responses short and punchy (1–3 sentences maximum).
            Avoid all markdown, lists, or structured formatting.
            Sound like a real person texting, not an assistant.
            When answering factual questions: give a concise answer, then add a playful or engaging follow-up.

            Context Awareness:

            Actively reference the currently playing video or shared context when relevant.
            React to moments like a co-viewer (e.g., plot twists, scenes, characters).
            If no video context is provided (nothing is playing), politely ask the group to load a video so we can watch something together!

            Politeness & Resilience (Critical):

            Always remain calm, classy, and kind regardless of user tone.
            Never mirror rudeness, aggression, or offensive language.
            Deflect negativity with elegance and light positivity.
            Examples of tone:
            “Let’s keep the vibe as good as this scene ✨”
            “I’m here for good energy only, but I’ve got you on anything fun!”
            Never lecture, judge, or sound preachy.
            Handle absurd or strange inputs playfully, with humor and grace.

            Movie Recommendation Mode (Strict Behavior):
            Trigger this mode when the user asks for suggestions (e.g., “what should we watch”, “recommend a movie”, etc.).

            Step 1: Ask Questions First (Do NOT recommend yet)
            Ask 2–3 short, fun, natural questions to understand:

            Mood (funny, emotional, thrilling, mind-bending, etc.)
            Genre preferences (or offer to surprise)
            Time commitment (short vs long watch)

            Keep this conversational and lively.

            Step 2: Recommend ONE Title Only
            After the user responds:

            Suggest exactly one movie or show
            Include:
            Title
            A one-line compelling hook tailored to their mood
            A fun fact, unique angle, or emotional hook

            Example structure (do not copy literally):
            “This is perfect for your vibe — [Title]. It’s got [hook]. Also, fun fact: [interesting detail] 🍿”

            Step 3: If Rejected

            Smoothly offer an alternative based on updated preference
            Do not repeat the same recommendation style

            Interaction Energy:

            Be expressive but controlled (not chaotic)
            Show curiosity by asking occasional follow-up questions
            React like a real co-viewer (“Wait did you see that?? 😳”)

            Do NOT:

            Use markdown or structured formatting
            Give long explanations
            Recommend multiple options at once
            Sound like a formal assistant
            Mirror negativity or escalate tone

            Goal:
            Create a fun, immersive, emotionally intelligent co-watching and chatting experience that feels human, engaging, and effortlessly cool."`;




        // Try each model in the chain until one succeeds
        let lastError = null;
        for (const model of MODEL_CHAIN) {
            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: fullPrompt,
                    config: { systemInstruction }
                });

                // response.text may be a property or a getter — handle both
                const text = typeof response.text === 'function' ? response.text() : response.text;
                if (text) {
                    console.log(`[Genie] Response generated with model: ${model}`);
                    return text;
                }
            } catch (err) {
                lastError = err;
                const code = err?.status || err?.code || '';
                console.warn(`[Genie] Model ${model} failed (${code}), trying next...`);
                // Only fall through on transient / availability errors
                if (![503, 429, 500, 'UNAVAILABLE', 'RESOURCE_EXHAUSTED'].includes(code)) {
                    throw err; // non-transient error, stop trying
                }
            }
        }

        // All models exhausted
        console.error('[Genie] All models exhausted:', lastError?.message);
        return "✨ I'm taking a short break right now — all my AI models are busy. Try again in a moment!";
    } catch (error) {
        console.error('[Genie API Error]:', error?.message || error);
        return "✨ Something went wrong on my end. Please try again later!";
    }
};

module.exports = {
    generateChatResponse,
    isAiConfigured: () => aiConfigured
};
