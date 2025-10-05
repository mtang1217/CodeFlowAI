This is a sophisticated AI Code Analyzer web application built with vanilla JavaScript, HTML, and CSS. It leverages the Gemini API to provide powerful code analysis capabilities through a clean, modern, and responsive user interface.
Core Features:
Multi-faceted Code Input: Users can easily provide code by dragging and dropping files/folders, using file/folder selection dialogs, or loading a built-in demo project.
AI-Powered Chat: The central feature is a chat interface where users can ask questions in natural language about the uploaded code. The application intelligently provides the file content as context to the Gemini model for accurate analysis.
Automated Graph Generation: With a single click, the application uses Gemini to analyze the code structure and generate a color-coded dependency graph using Mermaid.js. The graph is interactive, allowing users to pan, zoom, and download it as a PNG image.
Dependency Analysis: In parallel with graph generation, the app also uses Gemini with a specific JSON schema to identify and list all project dependencies (both local files and external libraries), providing a name, version, and a brief description for each.
Voice Interaction:
Text-to-Speech: AI responses can be read aloud using the ElevenLabs API, making it more accessible.
Speech-to-Text: Users can record their voice to dictate questions, which are transcribed by the ElevenLabs API and sent to the chat.
Modern UI/UX: The application features a polished, dual-themed (light/dark) interface that is responsive and works well on both desktop and mobile devices. It provides clear user feedback with loading indicators, success messages, and a well-organized tabbed layout for Chat, Graph, and Dependencies.
Technology Stack:
AI: Google Gemini API (@google/genai) for all intelligent features.
Frontend: Vanilla JavaScript (ESM), HTML5, CSS3.
Diagramming: mermaid.js for rendering code graphs.
Markdown: marked library for formatting AI chat responses.
Voice Services: ElevenLabs API for both TTS and STT.
