import { GoogleGenAI, Modality, Type } from "@google/genai";

// Let TypeScript know about the jsPDF library from the CDN
declare const jspdf: any;

interface CarouselSlide {
  image_prompt: string;
  header_text: string;
  subheader_text: string;
}

// --- Global State ---
let ai: GoogleGenAI;
let currentSlides: CarouselSlide[] = [];
let imageHistory: Map<number, string[]> = new Map();
let selectedImageIndices: Map<number, number> = new Map();
let editingSlideIndex: number | null = null;


// --- Main form elements ---
const form = document.getElementById('idea-form') as HTMLFormElement;
const ideaInput = document.getElementById('idea-input') as HTMLInputElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const loadingIndicator = document.getElementById('loading-container') as HTMLDivElement;
const loadingText = document.getElementById('loading-text') as HTMLParagraphElement;

// --- Output elements ---
const outputContainer = document.getElementById('results-container') as HTMLDivElement;
const captionContainer = document.getElementById('caption-container') as HTMLDivElement;
const imageGrid = document.getElementById('carousel-grid') as HTMLDivElement;
const savePdfButton = document.getElementById('save-pdf-button') as HTMLButtonElement;
const copyButton = document.getElementById('copy-button') as HTMLButtonElement;


// --- Settings Modal Elements ---
const settingsButton = document.getElementById('settings-button') as HTMLButtonElement;
const settingsModalOverlay = document.getElementById('settings-modal-overlay') as HTMLDivElement;
const closeSettingsButton = document.getElementById('close-settings-button') as HTMLButtonElement;
const saveSettingsButton = document.getElementById('save-settings-button') as HTMLButtonElement;
const resetSettingsButton = document.getElementById('reset-settings-button') as HTMLButtonElement;
const imagePromptInput = document.getElementById('image-prompt-input') as HTMLTextAreaElement;
const captionPromptInput = document.getElementById('caption-prompt-input') as HTMLTextAreaElement;
const temperatureSlider = document.getElementById('temperature-slider') as HTMLInputElement;
const temperatureValue = document.getElementById('temperature-value') as HTMLSpanElement;

// --- Edit Prompt Modal Elements ---
const editPromptModalOverlay = document.getElementById('edit-prompt-modal-overlay') as HTMLDivElement;
const editPromptTitle = document.getElementById('edit-prompt-title') as HTMLHeadingElement;
const closeEditPromptButton = document.getElementById('close-edit-prompt-button') as HTMLButtonElement;
const cancelEditPromptButton = document.getElementById('cancel-edit-prompt-button') as HTMLButtonElement;
const regenerateFromEditButton = document.getElementById('regenerate-from-edit-button') as HTMLButtonElement;
const editPromptTextarea = document.getElementById('edit-prompt-textarea') as HTMLTextAreaElement;

// --- Default Settings ---
const DEFAULT_IMAGE_PROMPT_SYSTEM_INSTRUCTION = `You are an expert Viral Instagram Carousel creator and art director. Your role is to generate the complete content plan for a 5-slide carousel: the visual concepts AND the text for each slide. The entire carousel must be thematically and visually cohesive.

### Core Directive: Plan-then-Execute
Before generating the final JSON, you must first think step-by-step:
1.  **Analyze Topic:** Briefly state the user's core topic.
2.  **Define Unified Theme:** Explicitly define the \`Color Palette\`, \`Artistic Style\`, and \`Overall Tone\` you will use for ALL slides. This is the most critical step for consistency.
3.  **Map Content to Framework:** Briefly outline the concept for each of the 5 slides (Hook, Problem, Insight, Solution, CTA).
4.  **Generate JSON:** Construct the final JSON output based on your plan.

### The Content Framework
You must adapt the user's topic to the 'Viral 5-Framework Carousel', generating both an image prompt and overlay text for each slide.
1.  **Slide 1: Hook (Stop the Scroll)** - A big, bold, curiosity-driven opener.
2.  **Slide 2: Problem (Pain Point)** - Call out a common frustration or challenge.
3.  **Slide 3: Insight (The 'A-ha' Moment)** - Drop a key truth, reframe, or surprising insight.
4.  **Slide 4: Solution (The Core Value)** - Present the solution, tips, or core message clearly.
5.  **Slide 5: CTA (Engagement Driver)** - End with a strong, clear action.

### Image Generation Rules
Your \`image_prompt\` must be highly effective for a modern AI image model (like Gemini).
-   **Text Rendering:** Crucially, the image prompt MUST instruct the image model to **render the \`header_text\` and \`subheader_text\` directly onto the image** in a clean, legible font that matches the theme.
-   **Composition:** Ensure each slide, while harmonized, is visually distinct to keep the user engaged.
-   **Technical Specs:** Specify the aspect ratio is **vertical (1080x1350)**. Where appropriate, use negative prompts (\`--no\`) to exclude unwanted elements (e.g., \`--no blurry text, ugly hands, watermarks\`).

### Output Format Rules
-   Return a single, valid JSON object.
-   The JSON object must have one key: "slides".
-   The value of "slides" must be an array of exactly 5 objects.
-   Each object in the array must have three string keys: "image_prompt", "header_text", and "subheader_text".

---
**## Example Application ##**

**If the User Topic is:** "5 tips for better sleep"

**Your JSON Output for that Example:**
{
  "slides": [
    {
      "image_prompt": "A soft, dreamy illustration of a starry night sky visible through a window, calm minimalist aesthetic. The image MUST include the text 'Still Awake at 3 AM?' as a bold header and 'Your endless scroll isn't the only reason. 👇' as a subheader in a clean, elegant font. Color palette: deep indigo, soft lavender, moonlight yellow. Vertical aspect ratio (1080x1350). --no jarring elements",
      "header_text": "Still Awake at 3 AM?",
      "subheader_text": "Your endless scroll isn't the only reason. 👇"
    },
    {
      "image_prompt": "A split-panel illustration in a dreamy style. One side shows a tired, frustrated person with a glowing phone; the other shows a clock face with racing hands. The image MUST include the text 'The Frustration' and 'You try to sleep, but your mind races...' in a clean font. Color palette: deep indigo, soft lavender. Vertical aspect ratio (1080x1350).",
      "header_text": "The Frustration",
      "subheader_text": "You try to sleep, but your mind races. You feel exhausted, but sleep won't come. It's a vicious cycle."
    },
    {
      "image_prompt": "A central, glowing lightbulb icon in moonlight yellow containing a small icon of a bed. The image MUST include the text 'The A-ha Moment' and 'Great sleep isn't about trying harder...' in a clean font. Background: serene deep indigo with soft lavender clouds. Vertical aspect ratio (1080x1350).",
      "header_text": "The 'A-ha' Moment",
      "subheader_text": "Great sleep isn't about trying harder. It's about smart, simple routines."
    },
    {
      "image_prompt": "An infographic-style illustration with five minimalist icons (sun/moon, book, no phone sign, cool thermometer, bed). The image MUST include the text 'Your 5-Step Sleep Ritual' and the list of 5 tips clearly laid out. Icons in moonlight yellow, background deep indigo. Vertical aspect ratio (1080x1350).",
      "header_text": "Your 5-Step Sleep Ritual",
      "subheader_text": "1. Consistent Schedule 2. Wind-Down Hour 3. No Screens in Bed 4. Cool, Dark Room 5. Get Morning Sunlight"
    },
    {
      "image_prompt": "A large, minimalist 'save' icon in moonlight yellow and lavender, with dreamy star accents. The image MUST include the text 'Save for Tonight' and 'Share this with a tired friend...' in a clean, inviting font. Background: deep indigo. Vertical aspect ratio (1080x1350).",
      "header_text": "Save for Tonight",
      "subheader_text": "Share this with a tired friend and reclaim your rest. ✨"
    }
  ]
}
---`;
const DEFAULT_CAPTION_SYSTEM_INSTRUCTION = `You are a world-class Instagram copywriter. Your goal is to write a viral, engaging caption for a 5-slide carousel post.
You will be given the content of the 5 slides.
Your caption MUST:
-   Be between 100-200 words.
-   Start with a strong, scroll-stopping hook.
-   Provide value and context for the carousel slides.
-   End with a clear call-to-action (e.g., asking a question, asking to save/share).
-   Include 5-10 relevant, high-traffic hashtags.
-   Have a professional yet conversational tone.
-   Be formatted with line breaks for readability.`;


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    loadSettings();
});

form.addEventListener('submit', handleSubmit);
savePdfButton.addEventListener('click', handleSaveAsPdf);
copyButton.addEventListener('click', handleCopyCaption);

// Settings Modal Listeners
settingsButton.addEventListener('click', openSettings);
closeSettingsButton.addEventListener('click', closeSettings);
settingsModalOverlay.addEventListener('click', (e) => {
    if (e.target === settingsModalOverlay) {
        closeSettings();
    }
});
saveSettingsButton.addEventListener('click', saveSettings);
resetSettingsButton.addEventListener('click', resetSettingsToDefaults);
temperatureSlider.addEventListener('input', () => {
    temperatureValue.textContent = temperatureSlider.value;
});

// Edit Prompt Modal Listeners
closeEditPromptButton.addEventListener('click', closeEditPromptModal);
cancelEditPromptButton.addEventListener('click', closeEditPromptModal);
editPromptModalOverlay.addEventListener('click', (e) => {
    if (e.target === editPromptModalOverlay) {
        closeEditPromptModal();
    }
});
regenerateFromEditButton.addEventListener('click', handleRegenerateFromEdit);

// --- Main Functions ---
async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!ideaInput.value.trim()) {
        alert("Please enter a topic or idea.");
        return;
    }

    // Reset state and UI for a new generation
    currentSlides = [];
    imageHistory.clear();
    selectedImageIndices.clear();
    outputContainer.classList.add('hidden');
    savePdfButton.classList.add('hidden');
    savePdfButton.disabled = true;

    try {
        setLoadingState(true, 'Step 1/3: Crafting viral prompts...');
        const slides = await generatePrompts(ideaInput.value);
        currentSlides = slides; // Store slides for PDF generation

        loadingText.textContent = 'Step 2/3: Generating stunning visuals...';
        const captionPromise = generateCaption(slides);
        const imagesPromise = generateAllImages(slides);

        const [caption] = await Promise.all([captionPromise, imagesPromise]);
        
        loadingText.textContent = 'Step 3/3: Finalizing the post...';
        displayCaption(caption);
        outputContainer.classList.remove('hidden');

        // Check if all images were generated successfully before enabling the PDF button
        const generatedImages = imageGrid.querySelectorAll('img');
        if (generatedImages.length === 5) {
            savePdfButton.classList.remove('hidden');
            savePdfButton.disabled = false;
        }

    } catch (error) {
        console.error("An error occurred:", error);
        alert(`An error occurred: ${error.message}`);
    } finally {
        setLoadingState(false);
    }
}


// --- API Call Functions ---
async function generatePrompts(topic: string): Promise<CarouselSlide[]> {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Apply the framework to this topic: "${topic}"`,
        config: {
            temperature: parseFloat(localStorage.getItem('temperature') || '0.9'),
            systemInstruction: localStorage.getItem('imagePrompt') || DEFAULT_IMAGE_PROMPT_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    slides: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                image_prompt: { type: Type.STRING },
                                header_text: { type: Type.STRING },
                                subheader_text: { type: Type.STRING },
                            },
                             required: ['image_prompt', 'header_text', 'subheader_text'],
                        },
                    },
                },
                required: ['slides'],
            },
        },
    });
    const json = JSON.parse(response.text);
    if (!json.slides || json.slides.length !== 5) {
        throw new Error("AI failed to generate the required 5 slides with text and prompts.");
    }
    return json.slides;
}

async function generateCaption(slides: CarouselSlide[]): Promise<string> {
    const promptText = slides.map((slide, i) => `Slide ${i + 1} Content:\n- Visuals: ${slide.image_prompt}\n- Text: "${slide.header_text} - ${slide.subheader_text}"`).join('\n\n');
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: promptText,
        config: {
            temperature: parseFloat(localStorage.getItem('temperature') || '0.9'),
            systemInstruction: localStorage.getItem('captionPrompt') || DEFAULT_CAPTION_SYSTEM_INSTRUCTION,
        },
    });
    return response.text.trim();
}

async function generateAllImages(slides: CarouselSlide[]): Promise<void> {
    setupImagePlaceholders(slides.length);
    const imagePromises = slides.map((slide, index) => generateImage(slide.image_prompt, index));
    await Promise.all(imagePromises);
}

async function generateImage(prompt: string, index: number): Promise<void> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
            const base64Image = response.candidates[0].content.parts[0].inlineData.data;
            const history = imageHistory.get(index) || [];
            history.push(base64Image);
            imageHistory.set(index, history);

            // Select the newly generated image
            selectedImageIndices.set(index, history.length - 1);
            renderSlideControls(index);
        } else {
            console.error(`No image data received for prompt index ${index}`);
            displayError(index, 'No image data');
        }
    } catch (error) {
        console.error(`Error generating image for prompt index ${index}:`, error);
        displayError(index, 'API Error');
    }
}

// --- Image Control Handlers ---

async function handleRegenerate(index: number) {
    const container = document.getElementById(`image-container-${index}`) as HTMLDivElement;
    const overlay = container.querySelector('.slide-spinner-overlay') as HTMLDivElement;
    if (overlay) {
        overlay.classList.remove('hidden');
    } else { // Handle case where it's regenerating from an error state
        container.innerHTML = `<div class="spinner"></div><span>Regenerating...</span>`;
        container.className = 'image-placeholder';
    }

    await generateImage(currentSlides[index].image_prompt, index);
    
    // The spinner overlay is part of the final rendered slide, so it will be there.
    // If we're coming from an error state, renderSlideControls will replace the placeholder.
    const finalContainer = document.getElementById(`image-container-${index}`) as HTMLDivElement;
    const finalOverlay = finalContainer.querySelector('.slide-spinner-overlay') as HTMLDivElement;
    if (finalOverlay) {
        finalOverlay.classList.add('hidden');
    }
}

function handleCycleImage(index: number, direction: 'prev' | 'next') {
    const history = imageHistory.get(index) || [];
    let currentIndex = selectedImageIndices.get(index) || 0;

    if (direction === 'prev' && currentIndex > 0) {
        currentIndex--;
    } else if (direction === 'next' && currentIndex < history.length - 1) {
        currentIndex++;
    }

    selectedImageIndices.set(index, currentIndex);
    renderSlideControls(index);
}


// --- UI Functions ---
function setLoadingState(isLoading: boolean, message: string = '') {
    if (isLoading) {
        loadingIndicator.classList.remove('hidden');
        loadingText.textContent = message;
        generateButton.disabled = true;
        generateButton.textContent = 'Generating...';
    } else {
        loadingIndicator.classList.add('hidden');
        generateButton.disabled = false;
        generateButton.textContent = 'Generate';
    }
}

function displayCaption(caption: string) {
    const captionText = document.getElementById('caption-text') as HTMLDivElement;
    if (!captionText) return;
    // Basic markdown-to-HTML conversion
    let html = caption.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    captionText.innerHTML = html;
}

function setupImagePlaceholders(count: number) {
    imageGrid.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'image-placeholder';
        placeholder.id = `image-container-${i}`;
        placeholder.innerHTML = `<div class="spinner"></div><span>Generating slide ${i + 1}...</span>`;
        imageGrid.appendChild(placeholder);
    }
}

function renderSlideControls(index: number) {
    const container = document.getElementById(`image-container-${index}`) as HTMLDivElement;
    if (!container) return;

    const history = imageHistory.get(index) || [];
    const currentIndex = selectedImageIndices.get(index) ?? 0;
    const currentImage = history[currentIndex];

    if (!currentImage) {
        displayError(index, 'No image found');
        return;
    }
    
    container.innerHTML = ''; // Clear previous content (spinner or error)
    container.className = 'carousel-slide';

    const img = document.createElement('img');
    img.src = `data:image/png;base64,${currentImage}`;
    img.alt = `Generated image for slide ${index + 1}, version ${currentIndex + 1}`;
    
    const controls = document.createElement('div');
    controls.className = 'slide-controls';

    // History controls
    const historyControls = document.createElement('div');
    historyControls.className = 'history-controls';
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'history-btn prev-btn';
    prevBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
    prevBtn.title = 'Previous version';
    prevBtn.disabled = currentIndex === 0;
    prevBtn.onclick = () => handleCycleImage(index, 'prev');

    const counter = document.createElement('span');
    counter.className = 'history-counter';
    counter.textContent = `${currentIndex + 1} / ${history.length}`;
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'history-btn next-btn';
    nextBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    nextBtn.title = 'Next version';
    nextBtn.disabled = currentIndex >= history.length - 1;
    nextBtn.onclick = () => handleCycleImage(index, 'next');

    if (history.length > 1) {
        historyControls.appendChild(prevBtn);
        historyControls.appendChild(counter);
        historyControls.appendChild(nextBtn);
    }

    // Action buttons
    const actionControls = document.createElement('div');
    actionControls.className = 'action-controls';

    const editBtn = document.createElement('button');
    editBtn.className = 'regenerate-btn';
    editBtn.title = 'Edit Prompt & Regenerate';
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    editBtn.onclick = () => openEditPromptModal(index);

    const regenBtn = document.createElement('button');
    regenBtn.className = 'regenerate-btn';
    regenBtn.title = 'Regenerate Image';
    regenBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
    regenBtn.onclick = () => handleRegenerate(index);

    actionControls.appendChild(editBtn);
    actionControls.appendChild(regenBtn);
    controls.appendChild(historyControls);
    controls.appendChild(actionControls);

    // Spinner overlay
    const spinnerOverlay = document.createElement('div');
    spinnerOverlay.className = 'slide-spinner-overlay hidden';
    spinnerOverlay.innerHTML = `<div class="spinner"></div>`;

    container.appendChild(img);
    container.appendChild(controls);
    container.appendChild(spinnerOverlay);
}


function displayError(index: number, message: string) {
    const container = document.getElementById(`image-container-${index}`) as HTMLDivElement;
    if (container) {
        container.className = 'carousel-slide';
        container.innerHTML = `
            <div class="error-message">
                <span>${message}</span>
                <button class="retry-button">Retry</button>
            </div>`;
        container.querySelector('.retry-button')?.addEventListener('click', () => handleRegenerate(index));
    }
}

// --- Settings Functions ---
function openSettings() {
    settingsModalOverlay.classList.remove('hidden');
}

function closeSettings() {
    settingsModalOverlay.classList.add('hidden');
}

function loadSettings() {
    const imagePrompt = localStorage.getItem('imagePrompt') || DEFAULT_IMAGE_PROMPT_SYSTEM_INSTRUCTION;
    const captionPrompt = localStorage.getItem('captionPrompt') || DEFAULT_CAPTION_SYSTEM_INSTRUCTION;
    const temperature = localStorage.getItem('temperature') || '0.9';

    imagePromptInput.value = imagePrompt;
    captionPromptInput.value = captionPrompt;
    temperatureSlider.value = temperature;
    temperatureValue.textContent = temperature;
}

function saveSettings() {
    localStorage.setItem('imagePrompt', imagePromptInput.value);
    localStorage.setItem('captionPrompt', captionPromptInput.value);
    localStorage.setItem('temperature', temperatureSlider.value);
    closeSettings();
    alert('Settings saved!');
}

function resetSettingsToDefaults() {
    if (confirm('Are you sure you want to reset all settings to their defaults?')) {
        localStorage.removeItem('imagePrompt');
        localStorage.removeItem('captionPrompt');
        localStorage.removeItem('temperature');
        loadSettings(); // Reload defaults into the form
        alert('Settings have been reset to default.');
    }
}

// --- Edit Prompt Modal Functions ---
function openEditPromptModal(index: number) {
    editingSlideIndex = index;
    editPromptTitle.textContent = `Edit & Regenerate Slide ${index + 1}`;
    editPromptTextarea.value = currentSlides[index].image_prompt;
    editPromptModalOverlay.classList.remove('hidden');
    editPromptTextarea.focus();
}

function closeEditPromptModal() {
    editingSlideIndex = null;
    editPromptModalOverlay.classList.add('hidden');
}

async function handleRegenerateFromEdit() {
    if (editingSlideIndex === null) return;

    const newPrompt = editPromptTextarea.value.trim();
    if (!newPrompt) {
        alert('Prompt cannot be empty.');
        return;
    }
    const currentIndex = editingSlideIndex; // Store index before closing modal
    
    // Update the central source of truth
    currentSlides[currentIndex].image_prompt = newPrompt;
    
    closeEditPromptModal();
    await handleRegenerate(currentIndex);
}


// --- Utility Functions ---
function handleCopyCaption() {
    const captionText = document.getElementById('caption-text') as HTMLDivElement;
    if (captionText) {
        const textToCopy = captionText.innerText;
        navigator.clipboard.writeText(textToCopy).then(() => {
            const copyButtonSpan = copyButton.querySelector('span');
            if (copyButtonSpan) {
                copyButtonSpan.textContent = 'Copied!';
                setTimeout(() => {
                    copyButtonSpan.textContent = 'Copy';
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy caption.');
        });
    }
}


// --- PDF Generation ---
async function handleSaveAsPdf() {
    // Robust check to ensure the jsPDF library is loaded
    if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
        console.error("jsPDF library is not loaded correctly.");
        alert("Error: PDF generation library is missing. Please refresh the page and try again.");
        return;
    }

    if (currentSlides.length !== 5) {
        alert("Carousel data is incomplete.");
        return;
    }

    const images = imageGrid.querySelectorAll('.carousel-slide img');
    if (images.length !== 5) {
        alert("Not all images have been generated successfully. Cannot create PDF.");
        return;
    }

    savePdfButton.disabled = true;
    const buttonSpan = savePdfButton.querySelector('span');
    if (buttonSpan) buttonSpan.textContent = 'Saving...';

    try {
        const { jsPDF } = jspdf;
        // Use a square format to match the carousel images
        const doc = new jsPDF({ orientation: 'p', unit: 'px', format: [400, 400] });

        images.forEach((img, index) => {
            if (index > 0) {
                doc.addPage([400, 400], 'p');
            }
            // Add image to fill the square page
            doc.addImage((img as HTMLImageElement).src, 'PNG', 0, 0, 400, 400);
        });

        // Sanitize the title for the filename
        const title = currentSlides[0]?.header_text?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'carousel';
        doc.save(`${title}.pdf`);

    } catch (error) {
        console.error("Failed to generate PDF:", error);
        alert("An error occurred while creating the PDF.");
    } finally {
        savePdfButton.disabled = false;
        if (buttonSpan) buttonSpan.textContent = 'Save as PDF';
    }
}