
-- 1. Terms versions
CREATE TABLE public.platform_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  title text NOT NULL,
  body_markdown text NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_terms TO anon, authenticated;
GRANT ALL ON public.platform_terms TO service_role;

ALTER TABLE public.platform_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active terms"
  ON public.platform_terms FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can read all terms"
  ON public.platform_terms FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert terms"
  ON public.platform_terms FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update terms"
  ON public.platform_terms FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_platform_terms_updated_at
  BEFORE UPDATE ON public.platform_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one active version at a time
CREATE UNIQUE INDEX platform_terms_single_active_idx
  ON public.platform_terms ((true)) WHERE is_active = true;

-- 2. Acceptance ledger
CREATE TABLE public.platform_terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_id uuid NOT NULL REFERENCES public.platform_terms(id) ON DELETE RESTRICT,
  terms_version integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  ip_hash text,
  context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, terms_id)
);

GRANT SELECT, INSERT ON public.platform_terms_acceptances TO authenticated;
GRANT ALL ON public.platform_terms_acceptances TO service_role;

ALTER TABLE public.platform_terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own acceptances"
  ON public.platform_terms_acceptances FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all acceptances"
  ON public.platform_terms_acceptances FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own acceptance"
  ON public.platform_terms_acceptances FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX platform_terms_acceptances_user_idx
  ON public.platform_terms_acceptances (user_id, terms_id);

-- 3. Helper: is current active version accepted?
CREATE OR REPLACE FUNCTION public.has_accepted_current_terms()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_terms_acceptances a
    JOIN public.platform_terms t ON t.id = a.terms_id
    WHERE a.user_id = auth.uid()
      AND t.is_active = true
  );
$$;

-- 4. Record acceptance (server-authoritative user_id + version snapshot)
CREATE OR REPLACE FUNCTION public.record_platform_terms_acceptance(
  p_terms_id uuid,
  p_user_agent text DEFAULT NULL,
  p_ip_hash text DEFAULT NULL,
  p_context text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version integer;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT version INTO v_version FROM public.platform_terms WHERE id = p_terms_id;
  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Terms version not found';
  END IF;
  INSERT INTO public.platform_terms_acceptances
    (user_id, terms_id, terms_version, user_agent, ip_hash, context)
  VALUES
    (auth.uid(), p_terms_id, v_version, p_user_agent, p_ip_hash, p_context)
  ON CONFLICT (user_id, terms_id) DO UPDATE
    SET accepted_at = now(),
        user_agent = COALESCE(EXCLUDED.user_agent, public.platform_terms_acceptances.user_agent),
        ip_hash = COALESCE(EXCLUDED.ip_hash, public.platform_terms_acceptances.ip_hash),
        context = COALESCE(EXCLUDED.context, public.platform_terms_acceptances.context)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 5. Seed the first version
INSERT INTO public.platform_terms (version, title, body_markdown, is_active, effective_at)
VALUES (
  1,
  'MODO BOOK Platform Terms & Conditions',
$md$
# MODO BOOK Platform Terms & Conditions

**Version 1 — Effective from account creation.**

These Terms form a binding agreement between **MODO BOOK** (a business based in the United Kingdom, contact **info@modobook.co.uk**) ("**MODO**", "we", "us") and the individual or entity registering an account ("**Practitioner**", "you"). By ticking the acceptance box and creating an account you confirm you have read, understood and agreed to these Terms. If you do not accept them, do not use the platform.

## 1. What MODO provides
MODO is a software platform that lets aesthetic and healthcare Practitioners take bookings, manage patients, hold clinical records, issue consent and medical forms, coordinate prescribers, and communicate with patients. MODO is **not** a clinical provider, prescriber, pharmacy or healthcare regulator. MODO does not provide medical, clinical or legal advice.

## 2. Eligibility
You warrant that:
- You are at least 18 years old and legally able to enter into this agreement.
- You hold, and will continuously maintain, all registrations, insurances, licences and qualifications required by law and by any regulator applicable to the services you deliver (including but not limited to, where applicable, the GMC, NMC, GDC, GPhC, HCPC, CQC, JCCP and Save Face).
- All information you provide about yourself, your clinic, your team and your services is accurate, up to date and not misleading.

## 3. Ownership of your data
You retain full ownership of the content and records you create or upload, including:
- Your patient records, medical forms, consent forms, clinical notes, photographs, prescriptions and correspondence.
- Your treatment catalogue, pricing, availability, branding, testimonials and marketing copy.

You grant MODO a limited, worldwide, royalty-free licence to host, process, transmit, back up and display that content **solely** to operate the platform for you and to comply with law.

## 4. Data protection — you are the Data Controller
You are the **Data Controller** in respect of all personal data of your patients and any other individuals whose data you process using the platform. MODO acts as your **Data Processor** and processes personal data on your documented instructions given through the platform. In particular you are solely responsible for:
- Establishing a lawful basis under the UK GDPR and Data Protection Act 2018 for every processing activity (including collection of medical information, marketing and photography).
- Providing a compliant privacy notice to your patients.
- Handling data subject requests (access, rectification, erasure, portability, objection).
- Reporting personal data breaches to the ICO and to affected individuals where required.
- Registering with the ICO and paying the data protection fee where required.

MODO will:
- Process personal data only on your instructions and as needed to run the platform.
- Apply reasonable technical and organisational security measures.
- Notify you without undue delay if we become aware of a personal data breach affecting your data.
- Assist you, at your cost where the assistance is not routine, with data subject requests and DPIAs.
- Return or delete your patient data on termination in accordance with clause 12.

The processing details required by UK GDPR Article 28 (subject-matter, duration, nature, purpose, types of data, categories of data subjects, obligations and rights) are recorded in the platform documentation and are incorporated into these Terms by reference. Where you require a separate signed Data Processing Agreement, contact **info@modobook.co.uk**.

## 5. Clinical responsibility
You are solely responsible for:
- All clinical decisions, diagnoses, treatments, aftercare and follow-up.
- Suitability assessments, contraindication checks and taking valid, informed consent for every treatment.
- The accuracy and completeness of medical forms, consent forms, notes, prescriptions and aftercare information you configure, send, sign or store using the platform.
- Managing complications, adverse events and complaints.
- Complying with advertising standards (including CAP/ASA rules on prescription-only medicines).

Templates, medical forms, consent forms, aftercare content, AI-suggested categories or AI-generated copy provided in the platform are examples only. You must review, adapt and approve them before use and take full responsibility for the version you deploy.

## 6. Prescribers and prescription-only medicines (POMs)
Where you use MODO to interact with an independent prescriber or to record prescribing activity:
- Each prescriber is independently responsible for their own clinical and regulatory obligations (GPhC / NMC / GMC etc.), their prescribing decisions, their record-keeping and their supply arrangements.
- You warrant that any prescription-only medicine you administer has been lawfully prescribed for the named patient by a prescriber who has personally assessed that patient in accordance with UK law and their regulator's guidance.
- You will not use MODO to promote, advertise or offer POMs to the public in breach of the Human Medicines Regulations 2012 or CAP Code.
- MODO does not supply, dispense, store or transport medicines and is not a party to any prescriber-patient or prescriber-pharmacy relationship.

## 7. Patients and third parties
You are responsible for the accuracy of information you enter about patients, for obtaining their consent to use the platform, and for your communications with them. Patients contract with **you**, not with MODO, for the clinical services you deliver. Any dispute between you and a patient is a matter for you to resolve.

## 8. Payments, deposits and refunds
Where the platform is used to take deposits or payments from patients, you set the price, deposit and cancellation rules. You are responsible for your own tax, VAT, invoicing, chargebacks and refunds. Fees charged by any payment processor are separate from MODO's fees. MODO is not a merchant of record for your patient bookings.

## 9. Subscription fees
Where a subscription or usage fee applies, it is charged in accordance with the plan you select. Fees are non-refundable except where required by law. We may change fees on at least 30 days' notice by email or in-app notice; continued use after the change takes effect confirms acceptance.

## 10. Acceptable use
You will not:
- Upload unlawful, defamatory, discriminatory or infringing content.
- Use the platform to send unsolicited marketing in breach of PECR or GDPR.
- Attempt to access another practitioner's account, patient records, or the platform's underlying systems.
- Reverse engineer, scrape, resell or white-label the platform without our written consent.
- Use the platform to make claims about safety, efficacy or clinical outcomes that you cannot substantiate.

## 11. Suspension
We may suspend or restrict your account without notice if we reasonably believe you are in serious breach of these Terms, are putting patients or other users at risk, or are causing legal or security risk to the platform. Where practical we will tell you why and give you a chance to remedy the issue.

## 12. Termination and data export
Either party may terminate this agreement on 30 days' written notice. On termination:
- You may export your patient records, appointments, forms and financial data through the platform, or request an export in a common machine-readable format, at any time up to **30 days** after termination.
- After that 30-day window MODO will delete your patient personal data from live systems within a further 30 days, subject to routine encrypted backups which are overwritten in the normal course of operation.
- We may retain anonymised, aggregated or de-identified data, and any records we are legally required to keep.

You remain solely responsible for keeping your own copies of clinical records to meet your regulator's retention requirements (typically at least 8 years for adult records, longer for minors).

## 13. Subprocessors
To operate the platform we use a small number of trusted subprocessors in categories such as cloud hosting and database, transactional email and SMS delivery, payment processing, error monitoring and customer support. The current list of subprocessors is available from **info@modobook.co.uk** on request. We will give you reasonable advance notice of material changes so that you can object; if you object on reasonable data-protection grounds and we cannot accommodate the objection, you may terminate for that reason.

## 14. Warranties and disclaimers
MODO is provided **"as is"** and **"as available"**. To the fullest extent permitted by law MODO disclaims all implied warranties, including fitness for a particular purpose, non-infringement and uninterrupted or error-free operation. MODO does not warrant that the platform will meet your regulator's specific requirements — you must satisfy yourself of that.

## 15. Indemnity
You will indemnify and hold MODO, its owners, staff and contractors harmless from and against any claim, loss, damage, fine, penalty or cost (including reasonable legal fees) arising out of or in connection with:
- Your clinical services, decisions or omissions.
- Your handling of patient personal data or your compliance with data-protection law.
- Any breach by you of these Terms, applicable law or a regulator's rules.
- Any content you upload or send using the platform.

## 16. Limitation of liability
Nothing in these Terms limits either party's liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for any liability that cannot lawfully be limited.

Subject to that:
- MODO is not liable for loss of profit, loss of business, loss of goodwill, loss of anticipated savings, loss of or corruption of data, or any indirect or consequential loss.
- MODO's total aggregate liability arising out of or in connection with the platform, whether in contract, tort (including negligence), breach of statutory duty or otherwise, is capped at the greater of (a) **£100** or (b) the total fees you paid to MODO in the **12 months** immediately before the event giving rise to the claim.

## 17. Confidentiality
Each party will keep the other's non-public information confidential and use it only for the purpose of this agreement. This does not apply to information that is public through no fault of the recipient, was already known, is independently developed, or must be disclosed by law.

## 18. Intellectual property
MODO retains all rights in the platform, its software, branding, templates and documentation. Nothing in these Terms transfers ownership of the platform to you.

## 19. Changes to these Terms
We may update these Terms from time to time. Material changes take effect on the date shown on the updated version. We will notify you in-app and by email, and you will be asked to re-accept the new version before continuing to use the platform. Your acceptance is recorded with a timestamp against your account.

## 20. Governing law and jurisdiction
These Terms are governed by the laws of **England and Wales**. The courts of England and Wales have exclusive jurisdiction over any dispute, except that MODO may bring proceedings against you in the courts of the country where you are established or where the breach occurred.

## 21. Contact
Questions, data-protection requests and notices should be sent to **info@modobook.co.uk**.

---

**By ticking "I agree to the MODO BOOK Terms & Conditions" and creating an account you confirm you accept these Terms in full. Your acceptance is recorded against your account with the date, time, version number, browser and a hashed record of your IP address.**
$md$,
  true,
  now()
);
