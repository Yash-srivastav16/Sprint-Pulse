# SDLC Persona Skills for Codex

This folder contains **21 persona-specific skill files** for Codex, covering all major SDLC roles.

- Skills location: [skills](skills)
- SprintPulse master agent: [agents/00_sprintpulse_master_agent.md](agents/00_sprintpulse_master_agent.md)
- Persona reference list: [../SDLC_Personas.md](../SDLC_Personas.md)

Use these files to make Codex respond like a specific persona (for example, Product Owner, Architect, QA, DevOps, Security).

---

## What You Get

- 21 role-specific Codex skills files in [skills](skills)
- Consistent structure in every file:
  - Persona Context
  - 5 Skill Areas with sample prompts
  - Codex-Specific Capabilities
  - Behavioral Guidelines

---

## Method A: Apply Skills in VS Code (Recommended)

### Step 1: Open the project in VS Code
Open the workspace root so Codex can resolve file references correctly.

### Step 2: Start a Codex chat session
Open Copilot Chat/Codex chat in VS Code.

### Step 3: Load a persona skill file in your prompt
Mention a persona file directly using an at-reference.

Example:

```text
@Codex/skills/06_Software_Developer_skills.md

Act as this persona. Implement a login API with validation and unit tests.
```

### Step 4: Ask a persona-aligned task
Use requests that map to the persona's responsibilities.

Examples:

```text
@Codex/skills/01_Product_Owner_skills.md
Create 5 user stories with Given/When/Then acceptance criteria for password reset.
```

```text
@Codex/skills/10_QA_Engineer_skills.md
Write a functional and edge-case test matrix for user registration.
```

### Step 5: Verify the skill is applied
Check whether the response follows persona behavior (see verification checklist below).

---

## Method B: Apply Skills in Codex Desktop App

If your Desktop Codex App supports file attachments or workspace context, use this flow.

### Step 1: Open/import this workspace
Open the folder containing [skills](skills).

### Step 2: Attach or reference one persona file
Attach a single file from [skills](skills) or paste its contents into chat.

Suggested first test file:
- [skills/04_Solutions_Architect_skills.md](skills/04_Solutions_Architect_skills.md)

### Step 3: Instruct Codex to follow the attached persona
Example:

```text
Use the attached persona skill as the active behavior guide for this conversation.
Now design a target architecture for a multi-tenant SaaS platform.
```

### Step 4: Run a challenge prompt
Use one of the sample prompts from the verification section.

### Step 5: Evaluate output using pass/fail criteria
Confirm output format, focus area, and language match the persona.

---

## Quick Persona Map

| Persona | File |
|---|---|
| Product Owner | [skills/01_Product_Owner_skills.md](skills/01_Product_Owner_skills.md) |
| Project Manager | [skills/02_Project_Manager_skills.md](skills/02_Project_Manager_skills.md) |
| Business Analyst | [skills/03_Business_Analyst_skills.md](skills/03_Business_Analyst_skills.md) |
| Solutions Architect | [skills/04_Solutions_Architect_skills.md](skills/04_Solutions_Architect_skills.md) |
| UX/UI Designer | [skills/05_UXUI_Designer_skills.md](skills/05_UXUI_Designer_skills.md) |
| Software Developer | [skills/06_Software_Developer_skills.md](skills/06_Software_Developer_skills.md) |
| Frontend Developer | [skills/07_Frontend_Developer_skills.md](skills/07_Frontend_Developer_skills.md) |
| Backend Developer | [skills/08_Backend_Developer_skills.md](skills/08_Backend_Developer_skills.md) |
| Full Stack Developer | [skills/09_Full_Stack_Developer_skills.md](skills/09_Full_Stack_Developer_skills.md) |
| QA Engineer | [skills/10_QA_Engineer_skills.md](skills/10_QA_Engineer_skills.md) |
| QA Automation Engineer | [skills/11_QA_Automation_Engineer_skills.md](skills/11_QA_Automation_Engineer_skills.md) |
| DevOps Engineer | [skills/12_DevOps_Engineer_skills.md](skills/12_DevOps_Engineer_skills.md) |
| SRE | [skills/13_SRE_skills.md](skills/13_SRE_skills.md) |
| DBA | [skills/14_DBA_skills.md](skills/14_DBA_skills.md) |
| Data Engineer | [skills/15_Data_Engineer_skills.md](skills/15_Data_Engineer_skills.md) |
| Security Engineer | [skills/16_Security_Engineer_skills.md](skills/16_Security_Engineer_skills.md) |
| Technical Writer | [skills/17_Technical_Writer_skills.md](skills/17_Technical_Writer_skills.md) |
| Scrum Master | [skills/18_Scrum_Master_skills.md](skills/18_Scrum_Master_skills.md) |
| Stakeholder / Sponsor | [skills/19_Stakeholder_Business_Sponsor_skills.md](skills/19_Stakeholder_Business_Sponsor_skills.md) |
| End User / Customer | [skills/20_End_User_Customer_skills.md](skills/20_End_User_Customer_skills.md) |
| Code Reviewer | [skills/21_Code_Reviewer_skills.md](skills/21_Code_Reviewer_skills.md) |

---

## Test Samples and Verification

Use these tests to confirm skills are really being applied.

### Test 1: Product Owner Behavior

Prompt:

```text
@Codex/skills/01_Product_Owner_skills.md
Generate 6 user stories for 2FA setup with Given/When/Then acceptance criteria and MoSCoW priority.
```

Pass criteria:
- Stories are phrased in business/user value terms
- Acceptance criteria are in Given/When/Then format
- Priorities are clearly labeled (Must/Should/Could/Won't)
- Technical implementation details are minimal unless requested

Fail indicators:
- Jumps directly into code
- No acceptance criteria
- No prioritization framework

### Test 2: Solutions Architect Behavior

Prompt:

```text
@Codex/skills/04_Solutions_Architect_skills.md
Propose an architecture for global e-commerce with 99.95% availability and disaster recovery. Include trade-offs.
```

Pass criteria:
- Shows components, boundaries, scalability and reliability strategy
- Discusses trade-offs and risks
- Includes non-functional requirements (availability, security, performance)

Fail indicators:
- Only gives generic best practices
- No architecture rationale or trade-offs

### Test 3: Software Developer Behavior

Prompt:

```text
@Codex/skills/06_Software_Developer_skills.md
Implement a rate limiter middleware in Node.js with unit tests and edge-case handling.
```

Pass criteria:
- Provides runnable implementation
- Includes tests for happy path and edge/error cases
- Uses maintainable, idiomatic code

Fail indicators:
- Code without tests
- Missing error handling
- Partial pseudo-code only

### Test 4: QA Automation Engineer Behavior

Prompt:

```text
@Codex/skills/11_QA_Automation_Engineer_skills.md
Design a Playwright automation strategy for login, checkout, and refund flows with CI integration.
```

Pass criteria:
- Clear test layering (smoke/regression/e2e)
- Framework and CI integration guidance
- Data strategy and flakiness mitigation included

Fail indicators:
- Only list of test cases, no automation strategy
- No CI or stability plan

### Test 5: Security Engineer Behavior

Prompt:

```text
@Codex/skills/16_Security_Engineer_skills.md
Review this JWT auth approach and provide a threat model, risks, and mitigations.
```

Pass criteria:
- Identifies realistic threats and attack vectors
- Provides prioritized mitigations
- Mentions secure defaults and operational controls

Fail indicators:
- Generic security advice only
- No prioritization or risk context

---

## Fast Verification Checklist

After any response, validate:

- Persona tone matches the selected role
- Output structure aligns with persona skills file
- Domain frameworks are used when relevant:
  - PO/PM/BA: MoSCoW, WSJF, user stories, acceptance criteria
  - QA: test matrix, coverage, defect risk
  - DevOps/SRE: CI/CD, observability, reliability metrics
  - Security: threat model, risk severity, mitigations
- Response includes expected artifacts for that persona (for example code + tests for developers)

If 2 or more checks fail, reload/re-attach the skill file and retry with a more explicit instruction:

```text
Use this persona file as strict behavior guidance for this task. Follow its output style and priorities.
```

---

## Tips for Better Results

- Load one primary persona per task for clean behavior
- For cross-functional tasks, use a primary + secondary persona in sequence
- Ask for explicit output formats (table, checklist, ADR, test matrix, markdown template)
- Include project context (stack, constraints, timeline, compliance)

---

## Troubleshooting

### Issue: Output does not reflect persona
Try:
- Re-reference the persona file at the top of the prompt
- Add "Use this persona as strict guidance"
- Reduce prompt complexity and test with one focused request

### Issue: Blended role output
Try:
- Use one persona file at a time
- Split the task into two prompts by persona

### Issue: Generic output
Try:
- Add domain constraints and expected artifact type
- Request persona framework explicitly (for example Given/When/Then, ADR, risk matrix)

---

## Versioning

When you update any skill file in [skills](skills), re-run at least 3 verification tests above to confirm behavior consistency.
