# SprintPulse AI Stack Decision

Decision date: May 11, 2026
Hackathon dates: May 16-17, 2026

## Goal

Build a focused product walkthrough for Semicolon. SprintPulse should personalize sprint health for each team member and show early warning signals from standups, Git, Jira, and delivery movement.

## Selected Stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript | Fast scaffold, easy for 3 FE members to split pages/components |
| UI | Plain CSS + lucide-react icons | Fast to polish, easy to tune for a premium product feel |
| Routing | React Router | Simple login/dashboard/member/standup routes |
| Backend | Node.js + Express + TypeScript | One backend owner can move fast and expose stable API contracts |
| Data | SprintPulse workspace API data | Keeps project, sprint, and role contracts stable before moving tables to Supabase |
| Auth | Supabase email/password | Real sign-in mapped to Product Owner, Scrum Master, developer, QA, and presenter roles |
| Integrations | Jira/GitHub/OpenAI adapter contracts | External connectors can be added behind the current API paths |

## Deferred Until Needed

| Deferred Item | Why |
| --- | --- |
| AWS Lambda/API Gateway/DynamoDB | Good production direction, but setup can consume early build time |
| Full audio upload + transcription | Add after manual, transcript, and upload flows are stable |
| Production persistence | Move personas/projects/sprints to Supabase tables after sign-in is verified |
| Full SSO | Supabase email/password is enough for the hackathon flow |

## Team Split

| Person | Role | Best First Ownership |
| --- | --- | --- |
| Atharv | Frontend | Dashboard summary and member cards |
| Yanshi | Frontend | Supabase login flow and route guards |
| Mahesh | Frontend | Standup submission and transcript paste flow |
| Yash | Backend | Express API, scoring logic, integration adapters |
| Vipin | Architect lead | API contracts, product architecture narrative |
| Himanshu | Architect | Data model, scoring rules, integration swap plan |
| Vikrant | QA | Test scenarios, risk cases, walkthrough validation checklist |
| Janice | QA/Presentation | Product story, pitch sequence, judge-facing narrative |

## Prep Timeline

| Date | Target |
| --- | --- |
| May 11 | Scaffold app, Supabase login, role-aware dashboard |
| May 12 | Manual standup submission and member details |
| May 13 | Transcript parser and scoring rules |
| May 14 | GitHub/Jira adapter contracts and better recommendations |
| May 15 | QA pass, walkthrough rehearsal, presentation story |
| May 16-17 | Hackathon execution, polish, optional real integrations |
