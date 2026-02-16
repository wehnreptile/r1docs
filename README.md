
# DevDocs Central

A centralized documentation portal designed for multi-product ecosystems. Built with React, Tailwind CSS, and Google Gemini AI.

## 🚀 Features

- **Markdown-First**: Write all documentation in standard `.md` files.
- **AI-Powered Search**: Uses Gemini 2.5 Flash with Search Grounding for semantic answers.
- **Product Categorization**: Organize docs by product (Consumer App, Backend, etc).

## 🛠 Local Setup

To run this project locally, you need [Node.js](https://nodejs.org/) installed.

1. **Clone the repo**:
   ```bash
   git clone <your-repo-url>
   cd devdocs-central
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set your API Key**:
   Create a `.env` file in the root directory:
   ```env
   VITE_API_KEY=your_gemini_api_key_here
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```
   The app will open automatically at `http://localhost:3000`.

## 📂 Directory Structure

- `/docs`: Markdown files organized by product subfolders.
- `/components`: UI components.
- `constants.tsx`: The "Manifest" file for registering new docs.
