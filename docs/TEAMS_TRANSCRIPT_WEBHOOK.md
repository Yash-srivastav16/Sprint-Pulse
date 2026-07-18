# Teams transcript auto-sync via Power Automate

Turn every Teams daily standup into SprintPulse standup entries automatically.
No admin consent, no Microsoft Graph app registration, no bots in the meeting.

## How it works

```
Daily standup ends in Teams
        ↓
Teams generates a transcript (~30s–2min later)
        ↓
Power Automate flow (Scrum Master's account) triggers
        ↓
HTTP POST → SprintPulse API /transcripts/teams-webhook
        ↓
SprintPulse parses speakers, matches to project members,
inserts one standup per matched speaker into the active sprint
```

## What you need

- **Scrum Master** has a Microsoft 365 license (any tier that includes Teams + Power Automate, which is most paid tiers).
- **Scrum Master is the organizer** of the recurring standup meeting. Power Automate's "When a new transcript is available" trigger fires for meetings the flow owner organized.
- **Teams transcription is enabled** in each standup. If the organizer doesn't click "Start transcription" or transcripts aren't enabled on the tenant, there's nothing to fetch.
- **SprintPulse API reachable on a public URL.** Local dev needs ngrok; production uses the deployed AWS URL.

## API endpoint

```
POST /api/projects/<projectId>/transcripts/teams-webhook
Content-Type: application/json
```

Body:

```jsonc
{
  "transcript": "WEBVTT\n\n1\n00:00:01.000 --> ...\n<v Alice>Yesterday I shipped the auth fix. Today I am writing tests. No blockers.",
  "organizerEmail": "alice@example.com",
  "meetingSubject": "Daily Standup — Project X",   // optional
  "meetingId": "abc-meeting-uuid"                    // optional
}
```

`transcript` accepts **VTT** (WEBVTT header, cue numbers, timestamps, `<v Speaker>` tags) **or plain text** with `Speaker:` markers. Both flow through the same parser.

Authorization: the `organizerEmail` must match a profile that is a member of the project. If it doesn't, the route returns 404 — no random external posts can land standups.

Responses:

| Status | When | Body |
|--------|------|------|
| 201 | Parsed and saved | `{ mode, note, project, parsed: [...], analysis, source: "teams-webhook", meetingSubject, meetingId, organizerEmail }` |
| 400 | `transcript` or `organizerEmail` missing | `{ error }` |
| 404 | Organizer is not a project member | `{ error }` |
| 500 | Parser or DB failure | `{ error }` |
| 501 | Mock flow enabled (`ENABLE_MOCK_FLOW=true`) | `{ error }` |

## Test before wiring Power Automate

```bash
curl -X POST http://localhost:4000/api/projects/<projectId>/transcripts/teams-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "organizerEmail": "<sm-email>",
    "meetingSubject": "Daily Standup",
    "transcript": "Alice: Yesterday I shipped the auth fix. Today I am writing tests. No blockers.\nBob: Yesterday I reviewed PRs. Today I am wiring the integrations panel. Blocked on Jira credentials."
  }'
```

If this returns 201 with `parsed` entries and the standups show up on the dashboard, the backend is good. The rest is just exposing the URL and wiring Power Automate.

## Expose the API on a public URL

### Option A — Production (AWS)

After deploying SprintPulse to AWS, the API is already on a public HTTPS URL. Use that. **This is the path for a real demo.**

### Option B — Local dev with ngrok

```bash
brew install ngrok/ngrok/ngrok
ngrok config add-authtoken <token-from-ngrok.com>  # one-time, free tier
ngrok http 4000
```

ngrok prints something like:

```
Forwarding  https://e1f2-152-58-194-23.ngrok-free.app -> http://localhost:4000
```

Use that HTTPS URL in Power Automate. The free tier rotates the URL on each restart — fine for testing, not for permanent hookup. The traffic inspector at <http://localhost:4040> is invaluable for debugging payload mismatches.

## Power Automate flow setup (Scrum Master, one-time)

1. Open <https://make.powerautomate.com> with your work account.
2. **+ Create → Automated cloud flow.**
3. Trigger: search **"When a new transcript is created"** (Microsoft Teams connector).
4. The trigger asks for the meeting whose transcripts you want to track. For daily standups, leave it on "All meetings I organize" if available, or pick the recurring meeting series.
5. **+ New step → HTTP**. (If HTTP isn't free, the "Send an HTTP request" Teams action works too.)
6. Configure the action:
   - **Method:** `POST`
   - **URI:** `https://<your-sprintpulse-host>/api/projects/<projectId>/transcripts/teams-webhook`
   - **Headers:** `Content-Type: application/json`
   - **Body:** click **Add dynamic content** and assemble:
     ```jsonc
     {
       "organizerEmail": "@{triggerOutputs()?['body/organizer/user/userPrincipalName']}",
       "meetingSubject": "@{triggerOutputs()?['body/subject']}",
       "meetingId": "@{triggerOutputs()?['body/meetingId']}",
       "transcript": "@{outputs('Get_transcript_content')?['body']}"
     }
     ```
     The exact dynamic-content field names vary slightly by region — use whatever Power Automate exposes for the transcript content, organizer email, and meeting subject. A common pattern is to add an action **"Get transcript content"** before the HTTP step.
7. **Save.**
8. Run the recurring standup once with transcription enabled. Open the flow's run history and confirm the HTTP step returned 201.

## Debugging checklist

- **Flow ran but nothing in SprintPulse:** check the HTTP step's response in the flow run history. 400/404/500 will all show the JSON error from the route.
- **`No project member matches organizer`**: the email in Teams (their UPN) doesn't match the `email` column on their SprintPulse profile. Either update the profile email or add the user to the project.
- **`Transcript is required`**: the dynamic-content field for transcript content was empty — usually means the "Get transcript content" action wasn't added before the HTTP step, or transcription wasn't enabled in the meeting.
- **Power Automate trigger never fires:** transcription wasn't enabled in the actual meeting. The trigger only fires when Teams successfully produces a transcript.

## Production hardening (optional)

The webhook is currently open — anyone who knows the URL can POST. For a hackathon demo that's fine; the `organizerEmail` → member-lookup gives some natural authorization. For real production, add either:

- **Shared-secret header**: have Power Automate add `X-SprintPulse-Webhook-Token: <random uuid>`. The route reads `process.env.TEAMS_WEBHOOK_TOKEN` and rejects non-matching requests.
- **Source IP allowlist**: lock the route to [Microsoft Power Automate egress IPs](https://learn.microsoft.com/en-us/power-platform/admin/online-requirements) at the AWS security group level.

Pick the shared-secret approach — simpler, doesn't break when Microsoft rotates IPs.
