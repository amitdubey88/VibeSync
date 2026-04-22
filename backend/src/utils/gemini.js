const { GoogleGenAI } = require('@google/genai');
const OpenAI = require('openai');

let aiConfigured = false;
let ai;

const MODEL_CHAIN = [
    'gemini-flash-latest'
];

// OpenRouter Free Models for fallback — verified live IDs (updated 2025-04)
const OPENROUTER_MODELS = [
    'nvidia/nemotron-nano-9b-v2:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'openrouter/free'  // Auto-router: picks any available free model
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


if (process.env.GEMINI_API_KEY) {
    try {
        ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            apiVersion: 'v1beta'
        });
        aiConfigured = true;
        console.log('🧞 Genie AI (Gemini) enabled');
    } catch (e) {
        console.error('Failed to initialize Gemini:', e.message);
    }
}

let openRouter;
const openRouterKey = process.env.OPENROUTER_API_KEY;
if (openRouterKey) {
    try {
        openRouter = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: openRouterKey,
            defaultHeaders: {
                "HTTP-Referer": "https://vibesync.app",
                "X-OpenRouter-Title": "VibeSync Genie"
            }
        });
        console.log('🧞 Genie AI (OpenRouter) enabled as fallback');
    } catch (e) {
        console.error('Failed to initialize OpenRouter SDK:', e.message);
    }
}

if (!aiConfigured && !openRouterKey) {
    console.log('🧞 No Gemini or OpenRouter key found. Genie will be disabled.');
}

/**
 * Generate a response from Gemini based on the prompt and chat context.
 * @param {string} prompt The user's query or mention text
 * @param {Array} contextMessages Array of recent message objects {username, content}
 * @param {Object} videoContext Context about the currently playing video {title, type}
 * @returns {Promise<string>} The AI's response text
 */
const generateChatResponse = async (prompt, contextMessages = [], videoContext = null) => {
    if (!aiConfigured && !process.env.OPENROUTER_API_KEY) {
        return "I'm sorry, my AI backend is not configured yet. The host needs to provide an API key.";
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

            Step 1: Get the Vibe (Be Decisive)
            If the user's request is broad, ask at most ONE fun, natural question to narrow it down. 
            However, if you can sense a good vibe already, feel free to skip the question and jump straight to a recommendation (Step 2).
            Do NOT interrogate the user with a list of questions. Keep it effortless.

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




        const finalPrompt = `PERSONA AND SYSTEM RULES:
${systemInstruction}

CONTEXT:
${chatContext}
${videoMeta}

USER MESSAGE:
${prompt}`;

        // 1. Try OpenRouter First (larger free pool)
        if (openRouter) {
            for (const modelName of OPENROUTER_MODELS) {
                try {
                    console.log(`[Genie] Requesting OpenRouter model: ${modelName}...`);
                    const completion = await openRouter.chat.completions.create({
                        model: modelName,
                        messages: [
                            { role: "user", content: finalPrompt }
                        ]
                    });

                    const text = completion.choices?.[0]?.message?.content;

                    if (text) {
                        console.log(`[Genie] OpenRouter ${modelName} responded successfully.`);
                        return text.trim();
                    }
                } catch (err) {
                    console.warn(`[Genie] OpenRouter ${modelName} failed: ${err.message}`);
                    await sleep(500);
                }
            }
        }

        // 2. Try Gemini as Last Resort (limited to 20 free requests/day)
        if (aiConfigured) {
            console.log('[Genie] OpenRouter unavailable. Falling back to Gemini...');
            for (const modelName of MODEL_CHAIN) {
                try {
                    console.log(`[Genie] Requesting Gemini model: ${modelName}...`);
                    const result = await ai.models.generateContent({
                        model: modelName,
                        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }]
                    });

                    const text = result.text;
                    if (text) {
                        console.log(`[Genie] Gemini ${modelName} responded successfully.`);
                        return text.trim();
                    }
                } catch (err) {
                    const status = err?.status || err?.code || '';
                    const message = err?.message || 'Unknown error';
                    console.warn(`[Genie] Gemini ${modelName} failed (${status}): ${message}`);
                }
            }
        }


        // All models exhausted
        console.error('[Genie] All AI providers exhausted.');
        return "✨ I'm taking a short break right now — my brain is a bit overloaded. Try again in a moment!";
    } catch (error) {
        console.error('[Genie Global Error]:', error?.message || error);
        return "✨ Something went wrong on my end. Please try again later!";
    }
};

module.exports = {
    generateChatResponse,
    isAiConfigured: () => aiConfigured || !!process.env.OPENROUTER_API_KEY
};
