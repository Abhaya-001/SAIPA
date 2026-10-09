# SAIPA — Self Autonomous Intelligent Portfolio Assistant

SAIPA is a portfolio dashboard and trading-research application built with React and FastAPI. It brings supported broker accounts, holdings, market information, and portfolio tools into one workspace.

**Maintainer:** [Abhaya-001](https://github.com/Abhaya-001)

## What SAIPA does

- Connects Alpaca and Binance accounts and displays portfolio and account information.
- Provides market views for stocks, crypto, and forex, alongside portfolio analytics and news.
- Includes a paper-trading research agent that learns a SPY exposure policy with Q-learning, records decisions, and reviews simulated rewards.
- Provides authentication, profile settings, trade history, and portfolio data export.

### Paper-agent limits

The agent uses Alpaca **paper** trading only. It is restricted to SPY, a maximum 5% portfolio exposure, and a $100 order-notional limit. Scheduling and paper-order submission are disabled until explicitly enabled in the Agent settings. Enabling paper orders requires acknowledging that the agent manages the account's SPY position; use a dedicated paper account.

Training and holdout results are simulations. They are not forecasts or actual account performance, and reinforcement learning does not guarantee profitable decisions.

## Technology

- **Frontend:** React, Vite, Tailwind CSS, Recharts
- **Backend:** Python, FastAPI, SQLAlchemy
- **Broker APIs:** Alpaca and Binance
- **Data and services:** SQLite by default, PostgreSQL optional, Redis/Celery optional
- **Market and news data:** yfinance and RSS feeds

## Requirements

- Python 3.10 or newer
- Node.js and npm
- Optional: PostgreSQL, Redis, Ollama, Google OAuth credentials, and SMTP service, depending on the features you want to use

## Run locally

### 1. Get the source

~~~bash
git clone https://github.com/Abhaya-001/SAIPA.git
cd SAIPA
~~~

### 2. Set up the backend

~~~powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
~~~

Create backend/.env. The Fernet encryption key is required:

~~~env
ENCRYPTION_KEY=your_generated_fernet_key
SECRET_KEY=replace_with_a_long_random_value
# Optional; SQLite is used by default
PORTFOLIO_DB_URL=sqlite:///./portfolio.db
~~~

Generate an encryption key with:

~~~bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
~~~

From the backend directory, start the API:

~~~bash
uvicorn main:app --reload
~~~

The API runs at http://localhost:8000. Interactive documentation is at http://localhost:8000/docs.

### 3. Set up the frontend

In a second terminal, from the repository root:

~~~bash
cd frontend
npm install
npm run dev
~~~

Open http://localhost:5173. If using Google sign-in, create frontend/.env and set VITE_GOOGLE_CLIENT_ID to your OAuth client ID.

### 4. Connect a broker

Sign in to SAIPA, open **Manage API Keys**, and link an account. Use broker-issued keys with the intended permissions and environment. For development, prefer Alpaca paper credentials and Binance demo credentials.

Never put broker keys in source files, README examples, or Git commits. Local .env files are ignored by Git.

## Use the paper agent

1. Link an Alpaca paper-trading account.
2. Open **Agent** and train the SPY policy.
3. Review the training and holdout metrics and recorded decisions.
4. Keep scheduling and paper-order submission off until you deliberately configure them. Paper-order submission requires the dedicated-account acknowledgement described above.

## Project layout

~~~text
backend/
  routers/       API routes, including broker, order, and agent routes
  services/      market data, news, and trading-agent logic
  main.py        FastAPI application
  models.py      database models
  requirements.txt
frontend/
  src/pages/     application pages, including Agent and Markets
  src/components/ shared interface components
  package.json   frontend dependencies and scripts
~~~

## Credits

- **Project maintainer:** [Abhaya-001](https://github.com/Abhaya-001)
- **Repository history and original project source:** [hariharalab/majorproject](https://github.com/hariharalab/majorproject)
