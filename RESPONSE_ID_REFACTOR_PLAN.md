# Refactoring Plan: Unique IDs for API Responses

## 1. Overview

This document outlines a two-phase plan to refactor the card system in `BaseCard.jsx`. The goal is to replace the current method of tracking in-flight API requests with a more reliable system that uses a unique ID for each query. This will prevent race conditions and ensure that responses always update the correct UI component, regardless of the order in which they return from the API.

The plan is designed to be implemented incrementally and to be backwards-compatible at each phase.

## 2. Relevant Files

The changes will be almost entirely encapsulated within one file:

*   `src/components/Map/components/Cards/BaseCard.jsx`

---

## Phase 1: Introduce the Unique ID System (Backwards-Compatible)

**Objective:** To add the new ID mechanism without altering the existing logic. This phase introduces the foundation for the new system safely.

**Steps:**

1.  **Generate a Unique ID for Each Query:**
    *   In `BaseCard.jsx`, locate the `handleAIQuery` function.
    *   At the very beginning of this function, create a unique ID for the new request. This ID will be passed through the entire process.
    *   ```javascript
      // Inside handleAIQuery...
      const queryId = `query_${Date.now()}`; // Simple, effective unique ID
      console.log(`🚀 New Query Started with ID: ${queryId}`);
      ```

2.  **Add the ID to the Response Object:**
    *   Modify the `updateResponseOnly` function to accept the `queryId`.
    *   When creating the "loading" placeholder card, include this new `id`.
    *   ```javascript
      // Inside updateResponseOnly, when isLoading is true...
      setResponses(prev => [...prev, { 
        id: queryId, // Add the new ID
        content: null, 
        citations: [], 
        isLoading: true 
      }]);
      ```

3.  **Pass the ID Through the Logic Chain:**
    *   Update all calls to `updateResponseOnly` within `handleAIQuery` to pass the `queryId` as the first argument.
    *   ```javascript
      // Inside handleAIQuery...
      
      // When starting the query:
      updateResponseOnly(queryId, null, [], true);

      // When the API call succeeds:
      updateResponseOnly(queryId, formattedResponse, citations, false);

      // When the API call fails:
      updateResponseOnly(queryId, errorResponse, [], false);
      ```

4.  **Update the `updateResponseOnly` Function Signature:**
    *   Change the function signature to accept the new `queryId`.
    *   ```javascript
      const updateResponseOnly = (queryId, newResponse, newCitations, isLoading = false) => {
        // ... function body remains the same for this phase
      };
      ```

**End of Phase 1 Result:** The application will now generate and store a unique ID for every card in the `responses` array. This has no impact on the UI or existing logic, making this phase perfectly backwards-compatible.

---

## Phase 2: Activate the Unique ID System & Fix the Race Condition

**Objective:** To switch the core logic to use the `queryId` for finding and updating responses, fixing the race condition.

**Steps:**

1.  **Modify the Core Logic in `updateResponseOnly`:**
    *   In `BaseCard.jsx`, inside the `updateResponseOnly` function, find the logic that updates a completed response (the `else` block).
    *   **Replace the unreliable `findIndex` call.** This is the most critical change.
    *   ```javascript
      // Inside updateResponseOnly, when isLoading is false...
      setResponses(prev => {
        const newResponses = [...prev];
        
        // --- OLD LOGIC ---
        // const loadingIndex = newResponses.findIndex(r => r.isLoading);

        // --- NEW, RELIABLE LOGIC ---
        const responseIndex = newResponses.findIndex(r => r.id === queryId);

        if (responseIndex !== -1) {
          newResponses[responseIndex] = { ...newResponses[responseIndex], content: newResponse, citations: newCitations, isLoading: false };
        } else {
          // Fallback for safety, though it shouldn't be needed
          newResponses.push({ id: queryId, content: newResponse, citations: newCitations, isLoading: false });
        }
        return newResponses;
      });
      ```

2.  **Clean Up and Finalize:**
    *   The system will now correctly use the unique ID to update the specific card that corresponds to the API request.
    *   The change is entirely contained within `BaseCard.jsx`, maintaining compatibility with the rest of the app.

**End of Phase 2 Result:** The race condition is resolved. The system can now handle multiple simultaneous requests and will always display the correct response in its corresponding card, making the application more robust and reliable.
