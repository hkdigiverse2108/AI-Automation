# ⚡ WhatsApp Marketing Platform & AI Automation

A high-performance, full-stack, enterprise-ready marketing and automation platform for WhatsApp. Built with **Next.js 14**, **Node.js/Express**, **MongoDB**, **Redis**, and integrated with **OpenAI & Grok/xAI** for advanced AI agent actions.

---

## 🚀 Key Features

*   **Unified Multi-Runner**: Run both frontend and backend development servers concurrently with a single command.
*   **AI-Powered Chat Agents**: Automate workflows, customer interactions, and lead routing using OpenAI and Grok/xAI models.
*   **Meta WhatsApp Business API Integration**: Production-ready connection to Meta's Cloud API with automated health checks.
*   **Visual Flow Builder**: Build and visualize sequence flows and automation triggers.
*   **Robust Campaign Scheduler**: Queue and broadcast campaigns to contacts with rate limiting and scheduling via Bull / Redis.
*   **Comprehensive Chat Logs**: Detailed dashboard tracking all client-agent interactions.
*   **Secure Authentication**: Role-Based Access Control (RBAC) with JWT (Access + Refresh tokens) and sensitive database field encryption.

---

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 14 (App Router), TailwindCSS, React Flow, Zustand, Lucide React |
| **Backend** | Node.js, Express, Socket.io, Mongoose (MongoDB), Bull (Redis queues) |
| **Integrations** | Meta Graph API, OpenAI API, Grok / xAI API, Cloudinary, Stripe |
| **DevOps** | Docker, Nodemon, Unified Multi-Runner |

---

## 📦 Getting Started

### Prerequisites

*   **Node.js**: `v18.x` or later
*   **MongoDB**: Local instance or MongoDB Atlas account
*   **Redis**: Local instance or Redis Cloud instance

### Installation & Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/gajeraprince05062006/WHATSAPP_API.git
    cd WHATSAPP_API
    ```

2.  **Configure Environment**:
    Create a `.env` file at the root of the project (refer to `.env.example` or the pre-configured unified `.env` file) and fill in your API credentials:
    ```bash
    # Simply update the root .env file with your database, Meta API, and AI keys.
    ```

3.  **Install Dependencies**:
    Install node packages inside both the `frontend` and `backend` subdirectories:
    ```bash
    # Install backend dependencies
    cd backend
    npm install

    # Install frontend dependencies
    cd ../frontend
    npm install
    ```

---

## ⚡ Concurrent Execution (One-Command Start)

This workspace features a customized concurrent multi-runner (`run.js`) which boots both development servers simultaneously, maps environment variables cleanly, color-codes standard streams, and avoids port conflicts.

To start the entire platform, run the following command in the **root directory**:

```bash
npm run dev
```

*   **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
*   **Backend API Service**: [http://localhost:5000/api](http://localhost:5000/api)

---

## 🔒 Security & Git Protection

A master `.gitignore` is configured at the root. All local environment files (`.env`, `.env.local`, `.env.production`), temporary cache files, build outputs (`.next`, `dist`), and dependency folders (`node_modules`) are **explicitly ignored** and will never be pushed to your public GitHub repository to keep your credentials safe.

---

## 📄 License

This project is licensed under the ISC License.
