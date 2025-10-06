# CodeFlowAI

This is a sophisticated AI-powered code analyzer web application built with vanilla JavaScript, HTML, and CSS. It leverages the **Gemini API** to provide powerful code analysis capabilities through a clean, modern, and responsive user interface.

## Core Features

### 1. Multi-faceted Code Input
- **Drag and Drop**: Users can easily drag and drop files/folders into the app.
- **File/Folder Selection Dialogs**: Users can browse their local machine to select files or folders for analysis.
- **Built-in Demo Project**: A demo project is available for users to explore the app's capabilities without uploading their own code.

### 2. AI-Powered Chat
The central feature of the app is the chat interface, where users can ask questions in natural language about the uploaded code. The app intelligently provides the file content as context to the **Gemini model** for accurate analysis and detailed responses.

### 3. Automated Graph Generation
- **Code Structure Analysis**: With a single click, the app analyzes the code structure using **Gemini** and generates a color-coded dependency graph.
- **Interactive Graph**: The graph is powered by **Mermaid.js**, and users can pan, zoom, and download it as a PNG image.

### 4. Dependency Analysis
- **Local & External Dependencies**: The app uses **Gemini** with a specific JSON schema to identify and list all project dependencies.
- **Dependency Information**: For each dependency, the app provides the name, version, and a brief description.

### 5. Voice Interaction
- **Text-to-Speech (TTS)**: AI responses can be read aloud using the **ElevenLabs API**, making the application more accessible.
- **Speech-to-Text (STT)**: Users can record their voice to dictate questions, which are transcribed by the **ElevenLabs API** and sent to the chat.

### 6. Modern UI/UX
- **Polished, Dual-Themed Interface**: The application offers both light and dark themes.
- **Responsive Design**: The app is fully responsive, ensuring an optimal experience on both desktop and mobile devices.
- **Clear User Feedback**: Features loading indicators, success messages, and a well-organized tabbed layout for **Chat**, **Graph**, and **Dependencies**.

## Technology Stack

- **AI**: [Google Gemini API](https://developers.google.com/genai) (`@google/genai`) for all intelligent features.
- **Frontend**: 
  - Vanilla JavaScript (ESM)
  - HTML5
  - CSS3
- **Diagramming**: [Mermaid.js](https://mermaid-js.github.io/mermaid/) for rendering code graphs.
- **Markdown**: [Marked](https://github.com/markedjs/marked) library for formatting AI chat responses.
- **Voice Services**:
  - **Text-to-Speech (TTS)** and **Speech-to-Text (STT)** powered by the [ElevenLabs API](https://elevenlabs.io/).

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/ai-code-analyzer.git
2. Set API Keys (Gemini API and ElevenLabs)
3. Run "python3 -m http.server"
4. Open "http://localhost:8000/"
