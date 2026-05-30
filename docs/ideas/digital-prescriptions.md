# Digital Prescription Network

**Status:** draft
**Area:** app · web · server
**Author:** @samudralaaravind
**Date:** 2026-05-30

## One-liner
A free, two-sided prescription layer: verified doctors write structured digital prescriptions on our platform and "send" them to patients, who accept to map the prescription to their account — turning every consultation into a warm, consented pharma acquisition channel.

## Problem
Today most Indian consultations end with a **paper prescription** — often illegible, easy to lose, and impossible to act on later:

- **Patients** lose the only copy of what they were prescribed. If the paper is gone, they re-consult (and re-pay) just to recover the list. There's no portable history to show a second doctor, and no record to fall back on if a drug causes side effects or a dispute with the doctor arises.
- **Online consults** (Practo, Apollo 24/7, Tata 1mg, MediBuddy, eSanjeevani) do produce a soft copy, but it's locked inside whichever platform the consult happened on — it's fragmented, not patient-owned, and not portable.
- **Doctors** have no lightweight way to keep track of what they prescribed across their offline + online practice, or to learn from their own prescribing history.

Net effect: the most valuable, high-intent moment in the whole pharma journey — *the instant a drug is prescribed* — is captured on paper and lost to everyone, including any pharmacy that could fulfil it.

## Proposal
A free feature (no premium gate) available to any registered user and any registered doctor.

**Flow**
1. **Doctor onboards & is verified** (NMC/state council registration number; later, HPR ID under ABDM).
2. During or after a consult, the doctor **searches our medicine catalog** and builds a structured prescription.
3. The doctor **searches for the patient** by username / phone number and sends a **prescription request**.
4. The patient **must accept** before the prescription is mapped to their account (consent-first — also our DPDP-friendly design).
5. Once accepted, the prescription lives in the patient's portable history, and we surface a **"buy these medicines on our platform"** recommendation → conversion into a pharmacy order.

**Structured prescription model** (replaces the illegible scrawl):

| # | Field | Example |
|---|-------|---------|
| 1 | Drug name | Amoxicillin |
| 2 | Strength | 500 mg |
| 3 | Dosage form | Tablet / Syrup / Gel / Patch |
| 4 | Dose amount (per dose) | 1 tablet |
| 5 | Frequency | Twice daily (1-0-1) |
| 6 | Duration | 5 days |
| 7 | Comments | After food |

Catalog-backed drug selection (autocomplete from our medicine DB) is what makes columns 1–4 clean, machine-readable, and directly mappable to a pharmacy SKU.

## Why patients use it
- **Never lose a prescription again** — it's mapped to their account permanently.
- **Portable history** — show full consultation/prescription history to any new doctor in one tap.
- **Safety & accountability** — a durable record if a drug causes side effects or for any dispute with the prescriber.
- **Legible, structured** — no more decoding handwriting.
- **Consent stays with the patient** — nothing maps without their explicit accept.

## Why doctors use it
- **One ledger for all prescriptions** — offline + online in one place.
- **Faster prescribing** — catalog autocomplete, reusable favourites/templates.
- **Learn from their own data** — prescribing patterns, refine future scripts.
- **Patient stickiness** — a clean digital trail of their care.

## Why this matters to the business
Our end goal is pharma. This feature sits *upstream of the purchase decision*, at the exact moment of prescribing — the cheapest, highest-intent acquisition point in the funnel. Every accepted prescription is a **consented, itemised, ready-to-fulfil cart**. The structured format means we can one-click map each line to a SKU and offer fulfilment.

It also quietly solves a regulatory headache: Schedule H/H1/X drugs legally need a valid prescription to dispense, and an **e-pharmacy that owns the prescription source has a compliance moat** competitors buying cold traffic don't.

## A mathematical vision (illustrative — assumptions, not authoritative)

### Market context (India)
> These are rough public-domain estimates to size the opportunity, not precise figures.

- **Population:** ~1.4 billion.
- **Registered allopathic doctors:** ~1.3 million (NMC); plus ~0.8M AYUSH practitioners.
- **Hospitals:** ~69,000 (≈43k private, ≈26k public), plus a long tail of clinics.
- **Outpatient consultations:** at ~3–4 visits per capita/year → **~4–5 billion consults/year**, i.e. **~11–13 million/day**.
- **Teleconsultation proof point:** govt eSanjeevani alone crossed ~150M+ cumulative consults — digital prescribing behaviour already exists at scale.
- **Pharma retail market:** ~₹2 lakh crore (~$24B); **e-pharmacy** ~$3B and growing ~30–40% CAGR.
- If ~70% of consults yield a prescription → **~2.8–3.5 billion prescriptions/year** is the true TAM for this feature.

### Bottom-up funnel (single city, beachhead model)
Pick one city and onboard doctors first (supply-led, since doctors pull patients in):

| Stage | Assumption | Result |
|-------|-----------|--------|
| Doctors onboarded | 1,000 | 1,000 |
| Consults/doctor/day | 30 | 30,000 consults/day |
| Yield a prescription | 70% | 21,000 scripts/day |
| Patient accepts mapping | 50% | 10,500 mapped/day |
| Convert to buy on our platform | 20% | 2,100 orders/day |
| Avg order value | ₹400 | **₹8.4L/day GMV** |

→ ≈ **₹25 Cr/year GMV** from *1,000 doctors in one city*. At a 12–15% pharmacy margin that's ~₹3–3.75 Cr/year contribution — from a single beachhead, before any premium/SaaS layer.

### Why the math scales
- **CAC ≈ near zero** for the medicine order: the lead is generated by the doctor inside a free feature, not bought.
- **Repeat is built in:** chronic-care prescriptions (diabetes, hypertension, thyroid) recur monthly → reorder reminders compound LTV.
- **Network effects:** a doctor on the platform pulls their patients on; a patient with history nudges their next doctor to join to read/continue it.

> Sensitivity: even at half the acceptance and half the conversion (25% × 10%), 1,000 doctors still drive ~525 orders/day ≈ ₹6.3 Cr/year GMV. The model holds.

## Regulatory & compliance notes (India)
- **Telemedicine Practice Guidelines 2020** (MoHFW/NMC) explicitly recognise e-prescriptions and teleconsultation — our digital script is on solid legal footing.
- **Drugs & Cosmetics Act / e-pharmacy rules:** Schedule H/H1/X dispensing needs a valid prescription — owning the prescription source is an advantage *and* an obligation (audit trail, prescriber verification).
- **DPDP Act 2023:** health data is sensitive personal data; our **patient-must-accept** design is consent-first by construction. Need explicit consent flows, purpose limitation, and the ability to revoke/withdraw mapping.
- **ABDM alignment (big upside):** link doctors via the **Healthcare Professionals Registry (HPR)** and patients via **ABHA** IDs; prescriptions could ride the Health Information Exchange. This is a credibility + interoperability moat.
- **Doctor verification is non-negotiable:** validate NMC/state-council registration to prevent fake prescribers and prescription fraud.

## Open questions
- **Doctor verification:** manual at first vs. NMC/HPR API integration — what's the MVP bar?
- **Liability:** if a structured prescription is mis-entered (wrong strength), where does responsibility sit between doctor input and our autocomplete? Need a doctor-signs/locks step.
- **Anti-fraud / abuse:** how do we stop fake "doctor" accounts or self-prescribing for controlled (Schedule X) drugs?
- **Catalog coverage:** is our medicine DB complete enough for autocomplete to feel trustworthy to doctors? Fallback for off-catalog/compounded drugs?
- **Offline-first reality:** for purely offline consults, how does the doctor capture this fast enough to not slow their OPD? (Templates, voice, scan-to-structure?)
- **Substitution:** when recommending purchase, do we offer generic/brand substitutes, and how does that interact with the doctor's intent?
- **Incentive for doctors:** beyond a free ledger, do we need analytics/templates to drive real adoption?
- **Conversion mechanics:** soft recommend vs. one-tap "add all to cart"? Delivery + reminders for chronic meds?

## Suggested MVP slice
1. Doctor account + manual NMC verification.
2. Catalog-backed structured prescription builder (the 7-column model).
3. Patient search (phone/username) → request → accept → mapped history.
4. "Buy on our platform" CTA mapping each line to a SKU.
5. Basic prescription history view for patient and doctor.

Defer: ABDM/HPR/ABHA integration, doctor analytics, templates/voice capture, substitution engine.
