/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { marked } from 'marked';
import mermaid from 'mermaid';

// --- DOM Elements ---
const dropZone = document.getElementById('drop-zone');
const dropZonePrompt = document.getElementById('drop-zone-prompt');
const dropZoneFeedback = document.getElementById('drop-zone-feedback');
const fileInput = document.getElementById('file-input');
const folderInput = document.getElementById('folder-input');
const loadDemoButton = document.getElementById('load-demo-button');
const fileList = document.getElementById('file-list');
const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const recordButton = document.getElementById('record-button');
const generateGraphButton = document.getElementById('generate-graph-button');
const chatTab = document.getElementById('chat-tab');
const graphTab = document.getElementById('graph-tab');
const dependenciesTab = document.getElementById('dependencies-tab');
const chatPanel = document.getElementById('chat-panel');
const graphPanel = document.getElementById('graph-panel');
const dependenciesPanel = document.getElementById('dependencies-panel');
const dependenciesContainer = document.getElementById('dependencies-container');
const graphContainer = document.getElementById('graph-container');
const downloadGraphButton = document.getElementById('download-graph-button');
const zoomInButton = document.getElementById('zoom-in-button');
const zoomOutButton = document.getElementById('zoom-out-button');
const zoomResetButton = document.getElementById('zoom-reset-button');
const themeToggleButton = document.getElementById('theme-toggle');

// --- App State ---
let files = [];
let chat = null;
let ai = null;
let isFileContextSent = false; // Tracks if the file context has been sent in the current chat session
let graphTransform = { x: 0, y: 0, scale: 1 };
let currentTheme = 'light';
let dropZoneResetTimeout;
let lastGeneratedGraphCode = null; // Stores the mermaid code for context

// --- ElevenLabs Config ---
const ELEVENLABS_API_KEY = 'd400c1c383b8df990fdba9b6c4b26eda8a4f57d8e5df962c73826eb58206ca2d';
const ELEVENLABS_VOICE_ID = 'UgBBYS2sOqTuMpoF3BR0';
let ttsState = {
    audio: null,
    button: null,
    isPlaying: false,
};
let recognitionState = {
    isRecording: false,
    mediaRecorder: null,
    stream: null,
};


// --- Initialization & API Setup ---
try {
  ai = new GoogleGenAI({ apiKey: "AIzaSyCheFkhhSK1CDFVRDB9VtoMidjQDTtxk9g" });
} catch (error) {
  console.error(error);
  addMessageToHistory(
    `Error initializing the AI. Please ensure your API key is set correctly.`,
    'assistant',
    true,
  );
}

// --- Mermaid Config ---
const getMermaidConfig = (theme) => {
  // Base config for both themes
  const baseConfig = {
    startOnLoad: false,
    theme: 'base', // We will manually override colors from the base theme
    fontFamily: "'Inter', sans-serif",
    class: {
      arrowMarkerAbsolute: true,
    },
  };

  if (theme === 'dark') {
    return {
      ...baseConfig,
      themeVariables: {
        background: '#242526', // Dark background for the graph panel
        lineColor: '#b0b3b8', // Arrow and line colors
        textColor: '#e4e6eb', // This will be the color for edge labels
        edgeLabelBackground: 'transparent', // No box behind edge labels
        classText: '#050505',
      },
    };
  }

  // Light theme config
  return {
    ...baseConfig,
    themeVariables: {
      background: '#FFFFFF', // Explicitly white background
      lineColor: '#65676B', // Arrow and line colors
      textColor: '#050505', // This will be the color for edge labels
      edgeLabelBackground: 'transparent', // No box behind edge labels
      classText: '#050505',
    },
  };
};


// --- Theme Management ---
async function applyTheme(theme) {
  currentTheme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem('theme', theme);

  // Re-initialize Mermaid for the new theme
  mermaid.initialize(getMermaidConfig(theme));
  
  // Re-render all visible mermaid diagrams
  // 1. Re-render main graph if visible
  const existingGraphCodeEl = document.querySelector('#graph-container .mermaid-code');
  if (existingGraphCodeEl && graphPanel.classList.contains('active')) {
    await renderGraph(existingGraphCodeEl.textContent || '');
  }

  // 2. Re-render graphs in chat history
  const chatMermaidElements = chatHistory.querySelectorAll('.mermaid');
  for (const el of Array.from(chatMermaidElements)) {
    const code = el.dataset.mermaidCode;
    if (code) {
        try {
            const id = `mermaid-${Date.now()}-${Math.random()}`; // needs unique id
            const { svg } = await mermaid.render(id, code);
            el.innerHTML = svg;
        } catch (e) {
            console.error('Mermaid re-rendering failed:', e);
        }
    }
  }
}

function toggleTheme() {
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
}


// --- UI Functions ---
function addMessageToHistory(
  message,
  sender,
  isError = false,
) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  if (isError) {
    messageDiv.classList.add('error');
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';

  if (sender === 'assistant') {
    contentDiv.innerHTML = marked.parse(message);
    contentDiv.querySelectorAll('.mermaid').forEach(async (el, index) => {
      const id = `mermaid-${Date.now()}-${index}`;
      const code = el.textContent || '';
      el.dataset.mermaidCode = code; // Store code for theme switching
      try {
        const { svg } = await mermaid.render(id, code);
        el.innerHTML = svg;
      } catch (e) {
        console.error('Mermaid rendering failed:', e);
        el.innerHTML = `<pre>Mermaid Error: ${e.message}</pre>`;
      }
    });
  } else {
    contentDiv.textContent = message;
  }

  messageDiv.appendChild(contentDiv);
  
  // Add TTS button for assistant messages
  if (sender === 'assistant' && !isError && message.trim().length > 0) {
      const ttsButton = document.createElement('button');
      ttsButton.className = 'tts-button';
      ttsButton.title = 'Play audio';
      ttsButton.innerHTML = getTTSIcon('play');
      ttsButton.onclick = () => playTextToSpeech(message, ttsButton);
      messageDiv.appendChild(ttsButton);
  }

  chatHistory.appendChild(messageDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function showLoadingIndicator() {
  const loadingMessage = document.createElement('div');
  loadingMessage.className = 'message assistant loading-indicator';
  loadingMessage.innerHTML = `
    <div class="content">
      <div class="spinner"></div> Thinking...
    </div>
  `;
  chatHistory.appendChild(loadingMessage);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return loadingMessage;
}

function updateFileList() {
  fileList.innerHTML = '';
  if (files.length === 0) {
    return;
  }
  files.forEach((file) => {
    const li = document.createElement('li');
    li.textContent = file.webkitRelativePath || file.name;
    fileList.appendChild(li);
  });
}

function setChatUiState(isLoading) {
  chatInput.disabled = isLoading;
  sendButton.disabled = isLoading;
  recordButton.disabled = isLoading;
  if (isLoading) {
    sendButton.innerHTML = `<div class="spinner"></div>`;
  } else {
    sendButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
         <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
      </svg>`;
  }
}

function switchTab(targetTabId) {
    const tabs = [
        { button: chatTab, panel: chatPanel, id: 'chat' },
        { button: graphTab, panel: graphPanel, id: 'graph' },
        { button: dependenciesTab, panel: dependenciesPanel, id: 'dependencies' },
    ];

    tabs.forEach(tab => {
        const isActive = tab.id === targetTabId;
        tab.button.classList.toggle('active', isActive);
        tab.button.setAttribute('aria-selected', String(isActive));
        tab.panel.classList.toggle('active', isActive);
        tab.panel.hidden = !isActive;
    });
}

// --- File Handling ---
function setDropZoneState(state, fileCount = 0) {
    clearTimeout(dropZoneResetTimeout);

    if (state === 'loading' || state === 'success') {
        dropZonePrompt.style.display = 'none';
        dropZoneFeedback.style.display = 'flex'; // Use flex for centering

        if (state === 'loading') {
            dropZoneFeedback.innerHTML = `
                <div class="spinner"></div>
                <p>Loading ${fileCount} file(s)...</p>
            `;
        } else { // success
            dropZoneFeedback.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="success-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>Successfully loaded ${fileCount} file(s).</p>
            `;
            dropZoneResetTimeout = window.setTimeout(() => setDropZoneState('default'), 2500);
        }
    } else { // default
        dropZonePrompt.style.display = 'block';
        dropZoneFeedback.style.display = 'none';
        dropZoneFeedback.innerHTML = '';
    }
}

function handleFiles(newFiles) {
  if (newFiles.length === 0) {
    return;
  }
  setDropZoneState('loading', newFiles.length);

  // Using setTimeout to allow the UI to update to the loading state before processing.
  setTimeout(() => {
    files = newFiles;
    lastGeneratedGraphCode = null; // Invalidate old graph
    updateFileList();
    
    if (files.length > 0) {
        addMessageToHistory(
            `Loaded ${files.length} file(s). What would you like to analyze?`,
            'assistant',
        );
        resetChat();
    }
    // Switch to success state after processing is done.
    setDropZoneState('success', files.length);
  }, 100);
}


async function loadDemoProject() {
  try {
    const demoFiles = {
      'main.js': `import { calculate } from './utils.js';
console.log('Result:', calculate(5, 3));`,
      'utils.js': `import { add } from './math.js';
export function calculate(a, b) {
  return add(a, b) * 2;
}`,
      'math.js': `export function add(a, b) {
  return a + b;
}
export function subtract(a, b) {
    return a-b;
}`,
    };
    const loadedFiles = Object.entries(demoFiles).map(
      ([name, content]) => {
        const file = new File([content], name, { type: 'text/javascript' });
        Object.defineProperty(file, 'webkitRelativePath', {
          value: `demo/${name}`,
        });
        return file;
      },
    );
    handleFiles(loadedFiles);
  } catch (e) {
    addMessageToHistory('Failed to load demo project.', 'assistant', true);
    console.error(e);
  }
}

// --- AI & Chat Logic ---
function resetChat() {
  if (!ai) return;
  chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are an expert code analysis assistant. Analyze the provided files to answer user questions. Be concise and clear. When asked to generate a graph, provide a Mermaid.js graph definition in a 'mermaid' code block.`,
    },
  });
  isFileContextSent = false; // Reset the context flag for the new session
}

async function sendMessage() {
  if (!ai) {
    addMessageToHistory('AI not initialized.', 'assistant', true);
    return;
  }
  if (!chat) {
     resetChat();
  }
  if (files.length === 0) {
    addMessageToHistory('Please upload some files first.', 'assistant');
    return;
  }

  const message = chatInput.value.trim();
  if (!message) return;

  stopCurrentTTS(); // Stop any TTS before sending a new message
  setChatUiState(true);
  addMessageToHistory(message, 'user');
  chatInput.value = '';
  const loadingIndicator = showLoadingIndicator();

  try {
    let promptToSend = message;

    // Only add the full file context for the FIRST message in a chat session.
    if (!isFileContextSent) {
        const fileContents = await Promise.all(
          files.map(async (file) => ({
            path: file.webkitRelativePath || file.name,
            content: await file.text(),
          })),
        );

        let context = `
          Analyzing the following files:
          ${fileContents
            .map((f) => `\n--- File: ${f.path} ---\n${f.content}`)
            .join('')}`;
            
        if (lastGeneratedGraphCode) {
            context += `
            
A Mermaid.js graph has already been generated with the following code. Use this as context if the user asks about the graph.
\`\`\`mermaid
${lastGeneratedGraphCode}
\`\`\`
            `;
        }
        
        promptToSend = `${context}\n\nUser query: ${message}`;
        isFileContextSent = true; // Mark context as sent for this session
    }

    const response = await chat.sendMessage({ message: promptToSend });
    loadingIndicator.remove();
    addMessageToHistory(response.text, 'assistant');
  } catch (error) {
    loadingIndicator.remove();
    addMessageToHistory(`An error occurred: ${error.message}`, 'assistant', true);
    console.error(error);
  } finally {
    setChatUiState(false);
  }
}

// --- Text-to-Speech & Speech-to-Text Logic ---
function getTTSIcon(type) {
    if (type === 'play') {
        return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>`;
    }
    if (type === 'pause') {
        return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-6-13.5v13.5" /></svg>`;
    }
    return '';
}

function stopCurrentTTS() {
    if (ttsState.audio) {
        ttsState.audio.pause();
        ttsState.audio.onended = null;
        ttsState.audio.onerror = null;
    }
    if (ttsState.button) {
        ttsState.button.disabled = false;
        ttsState.button.innerHTML = getTTSIcon('play');
    }
    ttsState = { audio: null, button: null, isPlaying: false };
}

async function playTextToSpeech(text, button) {
    if (ttsState.isPlaying && ttsState.button === button) {
        stopCurrentTTS();
        return;
    }

    stopCurrentTTS();

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = marked.parse(text);
    tempDiv.querySelectorAll('.mermaid').forEach(el => el.remove());
    const cleanText = (tempDiv.textContent || tempDiv.innerText || '').trim();

    if (!cleanText) return;

    button.disabled = true;
    button.innerHTML = '<div class="spinner"></div>';

    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
                text: cleanText,
                model_id: 'eleven_multilingual_v2',
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || 'ElevenLabs API error');
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        ttsState = { audio, button, isPlaying: true };
        
        button.innerHTML = getTTSIcon('pause');
        button.disabled = false;
        
        audio.play();
        
        audio.onended = () => stopCurrentTTS();
        audio.onerror = () => {
             console.error("Error playing audio.");
             stopCurrentTTS();
        }

    } catch (error) {
        console.error('Text-to-speech error:', error);
        addMessageToHistory(`Sorry, I couldn't play the audio: ${error.message}`, 'assistant', true);
        stopCurrentTTS();
    }
}

function getRecordIcon(state) {
    if (state === 'recording') {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M0 0h24v24H0z" fill="none"/><path d="M6 6h12v12H6z"/></svg>`;
    }
    if (state === 'loading') {
        return `<div class="spinner"></div>`;
    }
    // Default microphone icon
    return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 016 0v8.25a3 3 0 01-3 3z"></path>
    </svg>`;
}

function updateRecordButtonUI(isRecording, status = '') {
    recordButton.disabled = status === 'loading';

    if (isRecording) {
        recordButton.classList.add('recording');
        recordButton.setAttribute('aria-label', 'Stop recording');
        recordButton.innerHTML = getRecordIcon('recording');
    } else {
        recordButton.classList.remove('recording');
        if (status === 'loading') {
            recordButton.setAttribute('aria-label', 'Transcribing audio...');
            recordButton.innerHTML = getRecordIcon('loading');
        } else {
            recordButton.setAttribute('aria-label', 'Start recording');
            recordButton.innerHTML = getRecordIcon('default');
        }
    }
}

async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addMessageToHistory('Speech recognition is not supported by your browser.', 'assistant', true);
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recognitionState.stream = stream;
        recognitionState.mediaRecorder = new MediaRecorder(stream);
        
        const audioChunks = [];
        recognitionState.mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
        
        recognitionState.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            transcribeAudio(audioBlob);
        };
        
        recognitionState.mediaRecorder.start();
        recognitionState.isRecording = true;
        updateRecordButtonUI(true);
        
    } catch (err) {
        console.error('Error getting microphone access:', err);
        addMessageToHistory('Microphone access denied. Please allow microphone access in your browser settings to use this feature.', 'assistant', true);
    }
}

function stopRecording() {
    if (recognitionState.mediaRecorder && recognitionState.mediaRecorder.state !== 'inactive') {
        recognitionState.mediaRecorder.stop();
    }
    if (recognitionState.stream) {
        recognitionState.stream.getTracks().forEach(track => track.stop());
    }
    recognitionState.isRecording = false;
    updateRecordButtonUI(false, 'loading');
}

async function transcribeAudio(audioBlob) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.mp3');
    formData.append('model_id', 'scribe_v1');

    try {
        const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
            method: 'POST',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || `HTTP error! Status: ${response.status}`);
        }
        
        const result = await response.json();
        const transcribedText = result.text || '';
        
        chatInput.value += (chatInput.value.trim().length > 0 ? ' ' : '') + transcribedText;
        chatInput.focus();
        
    } catch (error) {
        console.error('Transcription Error:', error);
        addMessageToHistory(`Transcription failed: ${error.message}`, 'assistant', true);
    } finally {
        updateRecordButtonUI(false);
    }
}

async function toggleRecording() {
    if (recognitionState.isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}


// --- Graph & Dependencies Logic ---
async function generateGraph() {
  if (!ai) {
    addMessageToHistory('AI not initialized.', 'assistant', true);
    return;
  }
  if (files.length === 0) {
    addMessageToHistory('Please upload files before generating a graph.', 'assistant');
    return;
  }

  // Set loading states for both tabs and switch to the graph tab initially
  switchTab('graph');
  graphContainer.innerHTML = `
    <div class="graph-loading">
      <div class="spinner"></div>
      <p>Gemini is building the graph...</p>
    </div>`;
  dependenciesContainer.innerHTML = `
    <div class="dependencies-loading">
        <div class="spinner"></div>
        <p>Gemini is analyzing dependencies...</p>
    </div>`;

  try {
    const fileContents = await Promise.all(
      files.map(async (file) => ({
        path: file.webkitRelativePath || file.name,
        content: await file.text(),
      }))
    );

    const filesPrompt = fileContents
      .map((f) => `\n--- File: ${f.path} ---\n${f.content}`)
      .join('');

    // --- Create Graph Generation Promise ---
    const graphPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Analyze the following files and generate a detailed Mermaid.js class diagram.
        The diagram should represent classes, their most important variables and methods, and the relationships between them.

        **Styling Instructions:**
        1. First, analyze the code's dependency hierarchy to determine the "level" of each class. Level 1 classes are top-level entry points (e.g., containing 'main'). Level 2 are classes directly used by Level 1, and so on.
        2. After defining all classes and relationships, add a \`style\` directive for EACH class to color it based on its level. You MUST use the following color schemes:
           - Level 1: \`style [ClassName] fill:#e8f5e9,stroke:#2e7d32,stroke-width:2\`
           - Level 2: \`style [ClassName] fill:#e0f7fa,stroke:#0097a7,stroke-width:2\`
           - Level 3: \`style [ClassName] fill:#e3f2fd,stroke:#1565c0,stroke-width:2\`
           - Other levels: \`style [ClassName] fill:#e8eaf6,stroke:#283593,stroke-width:2\`

        **Formatting Rules:**
        - Use the format \`+String myVar\` for public variables and \`+void myMethod()\` for public methods.
        - Use a dotted arrow \`..>\` for a "uses" relationship.
        - Use a solid arrow \`-->\` for "creates and uses" or similar direct relationships.
        - Add labels to the relationships.

        Here is an example of the desired format:
        \`\`\`mermaid
        classDiagram
            direction TD

            class EmployManagementSystem {
                +static void main(String arv[])
            }
            class MainMenu {
                +void menu()
            }
            class Employee_Add {
                +void createFile()
            }
            class EmployDetail {
              +String name
              +String email
              +void getInfo()
            }

            EmployManagementSystem --> MainMenu : "creates and uses"
            EmployManagementSystem --> Employee_Add : "creates and uses"
            Employee_Add ..> EmployDetail : "uses"

            %% Apply styles based on levels
            style EmployManagementSystem fill:#e8f5e9,stroke:#2e7d32,stroke-width:2
            style MainMenu fill:#e0f7fa,stroke:#0097a7,stroke-width:2
            style Employee_Add fill:#e0f7fa,stroke:#0097a7,stroke-width:2
            style EmployDetail fill:#e3f2fd,stroke:#1565c0,stroke-width:2
        \`\`\`

        Only output the Mermaid code inside a \`\`\`mermaid block. Do not add any other text or explanation.
        ${filesPrompt}
      `,
    });

    // --- Create Dependency Analysis Promise ---
    const dependencySchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: 'The name or path of the imported module.',
          },
          version: {
            type: Type.STRING,
            description: "The version of the dependency, or 'local' if it's a local file.",
          },
          description: {
              type: Type.STRING,
              description: 'A brief description of the dependency purpose in the code.',
          }
        },
        required: ['name', 'version', 'description'],
      },
    };
    const dependenciesPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the provided code files and identify all imported modules or files. This includes both external libraries (from sources like package.json) and local file imports (e.g., './utils.js', '../math.js').

For each imported item, create a JSON object with the following properties:
- "name": The name or path of the imported module as it appears in the code (e.g., 'react', './utils.js').
- "version": If it's an external library with a specified version, provide the version number. If it is a local file, use the string "local". If the version is not available, use "N/A".
- "description": A brief, one-sentence description of what the imported module/file provides or is used for in the code.

Return the result as a single JSON array of these objects. If no imports are found, return an empty JSON array [].
      ${filesPrompt}`,
      config: {
          responseMimeType: 'application/json',
          responseSchema: dependencySchema
      }
    });

    // --- Await and Process Both Responses ---
    const [graphResponse, dependenciesResponse] = await Promise.all([graphPromise, dependenciesPromise]);

    // Process graph result
    const graphText = graphResponse.text;
    const mermaidCode = graphText.match(/```mermaid\n([\s\S]*?)\n```/);
    if (mermaidCode && mermaidCode[1]) {
      lastGeneratedGraphCode = mermaidCode[1]; // Save for chat context
      renderGraph(mermaidCode[1]);
    } else {
      lastGeneratedGraphCode = null;
      graphContainer.innerHTML = `<p>Sorry, I couldn't generate a graph from the provided files.</p><pre>${graphText}</pre>`;
    }

    // Process dependencies result
    const dependenciesResult = JSON.parse(dependenciesResponse.text);
    renderDependencies(dependenciesResult);

  } catch (error) {
    const errorMessage = `<p>An error occurred: ${error.message}</p>`;
    graphContainer.innerHTML = errorMessage;
    dependenciesContainer.innerHTML = errorMessage;
    console.error(error);
  }
}

async function renderGraph(mermaidCode) {
  try {
    // Store the raw code in a hidden element for re-rendering on theme change
    const hiddenCode = `<div class="mermaid-code" style="display: none;">${mermaidCode}</div>`;

    const { svg } = await mermaid.render(`graph-${Date.now()}`, mermaidCode);
    graphContainer.innerHTML = svg + hiddenCode; // Add the hidden code element
    const svgEl = graphContainer.querySelector('svg');
    if (svgEl) {
        setupGraphControls(svgEl);
        resetGraphView(svgEl);
    }
  } catch (e) {
    console.error('Mermaid rendering failed:', e);
    graphContainer.innerHTML = `<p>Failed to render the graph.</p><pre>${mermaidCode}</pre>`;
  }
}

function applyGraphTransform(element) {
    element.style.transform = `translate(${graphTransform.x}px, ${graphTransform.y}px) scale(${graphTransform.scale})`;
    element.style.transformOrigin = 'center center';
}

function resetGraphView(svgEl) {
    graphTransform = { x: 0, y: 0, scale: 1 };
    applyGraphTransform(svgEl);
}

function setupGraphControls(svgEl) {
    let isPanning = false;
    let startPoint = { x: 0, y: 0 };

    const pan = (e) => {
        if (!isPanning) return;
        graphTransform.x = e.clientX - startPoint.x;
        graphTransform.y = e.clientY - startPoint.y;
        applyGraphTransform(svgEl);
    }
    const startPan = (e) => {
        isPanning = true;
        startPoint = { x: e.clientX - graphTransform.x, y: e.clientY - graphTransform.y };
        graphContainer.classList.add('grabbing');
        graphContainer.addEventListener('mousemove', pan);
    };
    const endPan = () => {
        isPanning = false;
        graphContainer.classList.remove('grabbing');
        graphContainer.removeEventListener('mousemove', pan);
    };
    graphContainer.addEventListener('mousedown', startPan);
    graphContainer.addEventListener('mouseup', endPan);
    graphContainer.addEventListener('mouseleave', endPan);
    
    graphContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        graphTransform.scale = Math.max(0.2, Math.min(3, graphTransform.scale + delta));
        applyGraphTransform(svgEl);
    });

    zoomInButton.onclick = () => {
        graphTransform.scale = Math.min(3, graphTransform.scale + 0.2);
        applyGraphTransform(svgEl);
    };
    zoomOutButton.onclick = () => {
        graphTransform.scale = Math.max(0.2, graphTransform.scale - 0.2);
        applyGraphTransform(svgEl);
    };
    zoomResetButton.onclick = () => resetGraphView(svgEl);
}

function downloadGraphAsPNG() {
    const svgEl = graphContainer.querySelector('svg');
    if (!svgEl) {
        alert('No graph available to download.');
        return;
    }

    const padding = 20;
    const bbox = svgEl.getBBox();
    const canvas = document.createElement('canvas');
    canvas.width = bbox.width + padding * 2;
    canvas.height = bbox.height + padding * 2;
    const ctx = canvas.getContext('2d');

    // Get the theme-appropriate background color
    const bgColor = getComputedStyle(document.body).getPropertyValue('--surface-background').trim();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const data = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();

    img.onload = () => {
        ctx.drawImage(img, padding, padding);

        const link = document.createElement('a');
        link.download = 'code-graph.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
}

function renderDependencies(dependencies) {
    if (!dependencies || dependencies.length === 0) {
        dependenciesContainer.innerHTML = '<p>No dependencies were found in the provided files.</p>';
        return;
    }

    dependenciesContainer.innerHTML = ''; // Clear loading/previous content
    const list = document.createElement('ul');
    list.id = 'dependencies-list';

    dependencies.forEach(dep => {
        const li = document.createElement('li');
        const name = dep.name || 'Unknown';
        const version = dep.version || 'N/A';
        const description = dep.description || 'No description available.';

        li.innerHTML = `
            <div class="dep-header">
                <span class="dep-name">${name}</span>
                <span class="dep-version">${version}</span>
            </div>
            <p class="dep-description">${description}</p>
        `;
        list.appendChild(li);
    });

    dependenciesContainer.appendChild(list);
}


// --- Event Listeners ---
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer?.files) {
    handleFiles(Array.from(e.dataTransfer.files));
  }
});
fileInput.addEventListener('change', (e) =>
  handleFiles(Array.from(e.target.files || [])),
);
folderInput.addEventListener('change', (e) =>
  handleFiles(Array.from(e.target.files || [])),
);
loadDemoButton.addEventListener('click', loadDemoProject);
sendButton.addEventListener('click', sendMessage);
recordButton.addEventListener('click', toggleRecording);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
generateGraphButton.addEventListener('click', generateGraph);
chatTab.addEventListener('click', () => switchTab('chat'));
graphTab.addEventListener('click', () => switchTab('graph'));
dependenciesTab.addEventListener('click', () => switchTab('dependencies'));
themeToggleButton.addEventListener('click', toggleTheme);
downloadGraphButton.addEventListener('click', downloadGraphAsPNG);

// --- App Initializer ---
function init() {
  // Theme initialization must come before Mermaid initialization
  // Force light mode on startup per user request.
  const initialTheme = 'light';
  applyTheme(initialTheme); // This will call mermaid.initialize

  resetChat();
}

init();