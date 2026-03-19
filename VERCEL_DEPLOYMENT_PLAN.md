# Deployment Plan: The All-in-One Vercel Strategy

## 1. Overview

This document outlines a three-phase plan to deploy the full-stack application—including the React frontend, the Node.js SERP proxy, and the Python AlphaEarth service—onto Vercel. 

The goal is to create a modern, scalable, and cost-effective deployment by consolidating all parts of the application into a single project that leverages Vercel's serverless architecture. This strategy avoids the need for separate, always-on (and potentially costly) backend servers.

---

## Phase 1: Frontend Deployment & Initial Setup

**Objective:** Establish the foundation by deploying the React frontend to Vercel and configuring the project.

**Steps:**

1.  **Create Vercel Project:** Create a new project on the Vercel dashboard and connect it to the application's GitHub repository.

2.  **Initial Deployment:** Trigger a deployment. This will likely fail on the backend calls, but it will confirm that the React frontend builds correctly.

3.  **Configure Environment Variables:** In the Vercel project settings, add any environment variables that are used exclusively by the frontend (e.g., `REACT_APP_PRP` for the Perplexity API).

**Outcome:** The frontend UI is live and accessible via a Vercel URL. The application is ready for the backend services to be migrated.

---

## Phase 2: Migrating Backend Services to Serverless Functions

**Objective:** Move the two backend servers (`SERP API Proxy` and `AlphaEarth Service`) into the main project as Vercel Serverless Functions.

### A. Migrating the Node.js SERP Proxy

1.  **Create API Route:** In the root of your project, create a new directory named `api`.

2.  **Create Serverless Function:** Inside the `api` directory, create a file named `serp.js`.

3.  **Refactor Logic:** Copy the core logic from `proxy-server/server.js` into `/api/serp.js`. Refactor it from a full Express application into a single, exported function that accepts `request` and `response` objects. Vercel will automatically map this file to an `/api/serp` endpoint.

4.  **Update Frontend:** In `src/components/Map/components/Cards/SerpAPI.jsx`, change the `fetch` URL from `http://localhost:8080/serp` to the new relative path `/api/serp`.

5.  **Add Environment Variable:** Add the `SERP_API_KEY` to the Vercel project's environment variables.

### B. Migrating the Python AlphaEarth Service

1.  **Create Serverless Function:** Inside the `/api` directory, create a file named `alphaearth.py`.

2.  **Create Requirements File:** In the root of the project, create a `requirements.txt` file. Add all necessary Python dependencies (e.g., `Flask`, `google-api-python-client`, `earthengine-api`, `flask-cors`).

3.  **Refactor Logic:** Copy the logic from `alphaearth_server.py` and `alphaearth_api.py` into `/api/alphaearth.py`. Refactor the Flask application into a single handler function that Vercel can execute.

4.  **Update Frontend:** In `src/components/Map/components/Cards/AlphaEarthButton.jsx`, change the `fetch` URL from `http://localhost:5001/api/alphaearth/analyze` to the new relative path `/api/alphaearth`.

5.  **Add GEE Credentials:** Add your Google Earth Engine service account credentials (the JSON key file content) as an environment variable in the Vercel project settings.

**Outcome:** The frontend can now successfully call both backend services. The entire application is fully functional and running on Vercel's serverless infrastructure.

---

## Phase 3: Implementation of Authentication

**Objective:** Secure the application for use by a small, selected group of users.

**Steps:**

1.  **Integrate NextAuth.js:** Add `next-auth` as a dependency to your project.

2.  **Create Auth API Route:** Create a file at `/api/auth/[...nextauth].js`. This will handle all authentication requests (sign in, sign out, etc.).

3.  **Configure an Auth Provider:** For simplicity and security, configure the GitHub provider. This allows users to log in with their GitHub account. Add the necessary `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to your Vercel environment variables.

4.  **Protect the Application:** Wrap your main `App.js` or relevant components with the NextAuth.js `SessionProvider` and implement logic to require a user to be logged in before they can access the application content.

**Outcome:** The application is now secure and ready to be shared with your selected users. Only authenticated users will be able to access the map and its features.
