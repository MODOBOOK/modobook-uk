
-- Add structured sections + short summary to consent_templates
ALTER TABLE public.consent_templates
  ADD COLUMN IF NOT EXISTS sections jsonb,
  ADD COLUMN IF NOT EXISTS summary text;

-- Seed a large library of modern, sectioned, system consent templates.
-- Idempotent: only inserts when a system template of the same name doesn't already exist.
DO $seed$
DECLARE
  v_rows jsonb := '[
    {
      "name": "Anti-Wrinkle (Botulinum Toxin) Consent",
      "treatment_type": "anti_wrinkle",
      "summary": "Consent for botulinum toxin injections (e.g. Botox®, Azzalure®, Bocouture®) to soften dynamic lines.",
      "sections": [
        {"title":"What is the treatment?","body":"Botulinum toxin type A is a prescription-only medicine injected into small facial muscles to temporarily relax them, softening lines such as frown, forehead and crow''s feet."},
        {"title":"Common treatment areas","bullets":["Forehead lines","Frown lines (glabella)","Crow''s feet","Bunny lines","Brow lift","Lip flip","Masseter (jaw slimming)","Hyperhidrosis (excess sweating)"]},
        {"title":"Expected results","bullets":["Onset 3–14 days","Full effect by 2 weeks","Duration typically 3–4 months","Top-up may be required at 2 weeks"]},
        {"title":"Common side effects","bullets":["Redness, swelling, bruising","Headache for 24–48 hours","Temporary heaviness or tightness","Small bumps at injection sites"]},
        {"title":"Risks & possible complications","bullets":["Asymmetry","Eyelid or brow droop (ptosis)","Dry eyes / watery eyes","Difficulty with facial expression","Allergic reaction (rare)","Infection at injection site","Need for further treatment"]},
        {"title":"Contraindications","bullets":["Pregnant or breastfeeding","Neuromuscular disorders (e.g. myasthenia gravis)","Allergy to botulinum toxin or albumin","Active skin infection at site","Currently unwell"]},
        {"title":"Aftercare","bullets":["Stay upright for 4 hours","No exercise, alcohol or saunas for 24 hours","Avoid touching or massaging the area","No facials for 2 weeks"]}
      ]
    },
    {
      "name": "Dermal Filler (Hyaluronic Acid) Consent",
      "treatment_type": "filler",
      "summary": "Consent for hyaluronic acid dermal filler injections to restore volume, contour and hydration.",
      "sections": [
        {"title":"What is the treatment?","body":"Hyaluronic acid (HA) is a sugar naturally present in the skin. Injectable HA fillers add volume, definition and hydration. Results are immediate and last 6–18 months depending on product and area."},
        {"title":"Common treatment areas","bullets":["Lips","Cheeks","Tear troughs","Chin","Jawline","Nasolabial folds","Marionette lines","Temples"]},
        {"title":"Expected results","bullets":["Immediate volume","Final result at 2–4 weeks once swelling settles","Longevity 6–18 months","Top-ups recommended to maintain"]},
        {"title":"Common side effects","bullets":["Swelling 1–7 days","Bruising up to 2 weeks","Tenderness","Lumps or small bumps that usually settle","Temporary asymmetry"]},
        {"title":"Risks & possible complications","bullets":["Infection","Allergic reaction","Persistent lumps or nodules","Granuloma","Tyndall effect (blue-grey tint)","Cold sore reactivation","Vascular occlusion — rare but serious; may cause skin necrosis or, very rarely, blindness","Need for hyaluronidase to dissolve product"]},
        {"title":"Contraindications","bullets":["Pregnant or breastfeeding","Active skin infection or acne at site","Autoimmune disease or active inflammatory condition","Known allergy to HA or lidocaine","Bleeding disorders / blood thinners (assess case-by-case)","Recent dental work (last 2 weeks)"]},
        {"title":"Aftercare","bullets":["Avoid alcohol for 24 hours","No strenuous exercise for 24–48 hours","No make-up for 12 hours","Avoid heat: saunas, sunbeds, hot yoga for 2 weeks","Sleep slightly elevated for 2 nights","Use arnica if bruising"]}
      ]
    },
    {
      "name": "Lip Filler Consent",
      "treatment_type": "lip_filler",
      "summary": "Consent specifically for hyaluronic acid lip enhancement.",
      "sections": [
        {"title":"About lip filler","body":"Hyaluronic acid is injected into the lips to add volume, definition, hydration or to correct asymmetry. The amount and technique are tailored to your goals and natural anatomy."},
        {"title":"Expected results","bullets":["Immediate volume and shape","Significant swelling for 24–72 hours","Final settled result at 2–4 weeks","Longevity 6–12 months"]},
        {"title":"Common side effects","bullets":["Marked swelling for up to 1 week","Bruising","Tenderness","Lumps or unevenness that typically settle","Cold sore reactivation"]},
        {"title":"Risks","bullets":["Infection","Allergic reaction","Persistent lumps requiring dissolving","Vascular occlusion — rare but serious","Tyndall effect","Unsatisfactory cosmetic result"]},
        {"title":"Contraindications","bullets":["Pregnant or breastfeeding","Active cold sore or facial infection","History of severe cold sores (consider prophylactic aciclovir)","Autoimmune flare","Allergy to HA or lidocaine"]},
        {"title":"Aftercare","bullets":["Sip water, avoid hot drinks for 24 hours","No make-up on lips for 12 hours","Avoid kissing, straws and lip products 24 hours","Ice gently if swollen","No exercise or alcohol for 24 hours","Avoid dental work for 2 weeks"]}
      ]
    },
    {
      "name": "Sculptra® (Poly-L-Lactic Acid) Consent",
      "treatment_type": "biostimulator",
      "summary": "Consent for Sculptra® collagen-stimulating injections.",
      "sections": [
        {"title":"What is Sculptra®?","body":"Sculptra® is an injectable collagen stimulator made from poly-L-lactic acid (PLLA). It works by stimulating your body''s natural collagen production over weeks to months. Results are gradual and not immediate."},
        {"title":"Common treatment areas","bullets":["Cheeks","Temples","Jawline","Chin","Lower face","Areas of facial volume loss"]},
        {"title":"Expected results","bullets":["Develop over 6–12 weeks","Usually 2–4 sessions required","Results may last up to 2 years","Maintenance treatments recommended"]},
        {"title":"The procedure","bullets":["Medical assessment","Cleanse treatment area","Injection by needle or cannula","Massage to distribute product","Takes 30–60 minutes"]},
        {"title":"Common side effects","bullets":["Redness, swelling, bruising","Tenderness","Itching","Small temporary lumps under the skin"]},
        {"title":"Risks","bullets":["Infection","Allergic reaction","Persistent swelling","Delayed inflammatory reactions","Nodules / granulomas","Asymmetry","Product migration","Scarring","Vascular occlusion (rare but serious)"]},
        {"title":"Contraindications","bullets":["Pregnant or breastfeeding","Active skin infection","Autoimmune condition","Uncontrolled diabetes","Bleeding disorders","Allergy to any ingredient"]},
        {"title":"Aftercare","bullets":["Massage area 5 minutes, 5 times a day, for 5 days","Avoid strenuous exercise 24 hours","Avoid alcohol 24 hours","No heat treatments for 2 weeks"]}
      ]
    },
    {
      "name": "Profhilo® Consent",
      "treatment_type": "skin_booster",
      "summary": "Consent for Profhilo® bio-remodelling treatment.",
      "sections": [
        {"title":"About Profhilo®","body":"Profhilo® is a stabilised hyaluronic acid injected at specific points to hydrate the skin and stimulate collagen and elastin. It bio-remodels rather than volumises."},
        {"title":"Treatment plan","bullets":["2 sessions, 4 weeks apart","Top-up every 6 months","Common areas: face, neck, décolletage, hands, arms, knees"]},
        {"title":"Common side effects","bullets":["Small bumps at injection points for 24 hours","Redness, mild swelling","Bruising"]},
        {"title":"Risks","bullets":["Infection","Allergic reaction","Persistent lumps","Vascular occlusion (rare)"]},
        {"title":"Contraindications","bullets":["Pregnant or breastfeeding","Active skin infection","Autoimmune condition","Allergy to hyaluronic acid"]},
        {"title":"Aftercare","bullets":["Do not massage bumps — they absorb in 24 hours","Avoid make-up 12 hours","No exercise, alcohol, sauna for 24 hours","Avoid sunbeds 2 weeks"]}
      ]
    },
    {
      "name": "Skin Booster Consent (Seventy Hyal / Sunekos / Jalupro)",
      "treatment_type": "skin_booster",
      "summary": "General consent for injectable skin-hydration boosters.",
      "sections": [
        {"title":"What is a skin booster?","body":"Skin boosters are injectable hyaluronic acid (sometimes combined with amino acids or peptides) used to hydrate, smooth and improve skin quality."},
        {"title":"Treatment plan","bullets":["Course of 2–4 sessions, 2–4 weeks apart","Maintenance every 4–6 months"]},
        {"title":"Common side effects","bullets":["Redness, swelling at injection sites","Bruising","Small bumps that settle within 24–48 hours"]},
        {"title":"Risks","bullets":["Infection","Allergic reaction","Persistent lumps","Vascular event (rare)"]},
        {"title":"Contraindications","bullets":["Pregnancy or breastfeeding","Active skin infection","Autoimmune disease","Known allergy"]},
        {"title":"Aftercare","bullets":["Avoid make-up 12 hours","No exercise, alcohol, heat for 24 hours","No facials 2 weeks"]}
      ]
    },
    {
      "name": "Polynucleotides Consent",
      "treatment_type": "polynucleotides",
      "summary": "Consent for polynucleotide injections (e.g. Plinest®, Ameela™).",
      "sections": [
        {"title":"About polynucleotides","body":"Polynucleotides are purified DNA fragments injected to repair, regenerate and rejuvenate the skin. They improve skin quality, elasticity and reduce inflammation."},
        {"title":"Treatment plan","bullets":["Course of 2–3 sessions, 3–4 weeks apart","Maintenance every 6 months","Common areas: under eyes, face, neck, scalp"]},
        {"title":"Common side effects","bullets":["Swelling, redness, bruising","Tenderness","Small papules at injection sites"]},
        {"title":"Risks","bullets":["Infection","Allergic reaction","Persistent lumps","Vascular event (rare)"]},
        {"title":"Contraindications","bullets":["Pregnant or breastfeeding","Active skin infection","Autoimmune disease","Allergy to fish proteins (some products)"]},
        {"title":"Aftercare","bullets":["No make-up 12 hours","Avoid exercise, alcohol, heat 24 hours","No facials 2 weeks"]}
      ]
    },
    {
      "name": "Microneedling Consent",
      "treatment_type": "microneedling",
      "summary": "Consent for microneedling (collagen induction therapy).",
      "sections": [
        {"title":"About microneedling","body":"Fine needles create controlled micro-channels in the skin to stimulate collagen and improve texture, scarring, pigmentation and fine lines."},
        {"title":"Treatment plan","bullets":["Course of 3–6 sessions, 4 weeks apart","Maintenance every 6 months"]},
        {"title":"Common side effects","bullets":["Redness 24–48 hours","Mild swelling","Dryness or flaking","Sensitivity"]},
        {"title":"Risks","bullets":["Infection","Post-inflammatory hyperpigmentation","Cold sore reactivation","Scarring (rare)","Milia"]},
        {"title":"Contraindications","bullets":["Active acne or skin infection","Pregnant or breastfeeding","Keloid scarring","Recent isotretinoin (within 6 months)","Active eczema or psoriasis at site"]},
        {"title":"Aftercare","bullets":["No make-up for 24 hours","Use only recommended post-care serum","Avoid sun, sweat, swimming for 48 hours","Daily SPF50 for 2 weeks"]}
      ]
    },
    {
      "name": "Chemical Peel Consent",
      "treatment_type": "peel",
      "summary": "Consent for superficial / medium-depth chemical peels.",
      "sections": [
        {"title":"About chemical peels","body":"A chemical solution (AHA, BHA, TCA or blends) is applied to exfoliate the skin and improve tone, texture, pigmentation and acne."},
        {"title":"Expected experience","bullets":["Tingling or stinging during treatment","Redness for 24–72 hours","Peeling and flaking for 3–7 days","Final result over 2–4 weeks"]},
        {"title":"Risks","bullets":["Hyperpigmentation or hypopigmentation","Prolonged redness","Cold sore reactivation","Infection","Scarring (rare)","Allergic reaction"]},
        {"title":"Contraindications","bullets":["Pregnant or breastfeeding","Recent isotretinoin (6 months)","Active eczema, psoriasis or infection","Sunburn or recent sun exposure","History of keloid scarring"]},
        {"title":"Aftercare","bullets":["Do not pick or peel skin","No make-up 12–24 hours","Avoid exfoliants and retinoids 7 days","Daily SPF50","Gentle cleanser and moisturiser only"]}
      ]
    },
    {
      "name": "Fat Dissolving Injections Consent (Aqualyx / Lemon Bottle)",
      "treatment_type": "fat_dissolving",
      "summary": "Consent for injectable lipolysis treatments.",
      "sections": [
        {"title":"About the treatment","body":"Solutions are injected into subcutaneous fat to break down fat cells. Treated areas may include chin, jowls, bra fat, flanks, abdomen, thighs and arms."},
        {"title":"Treatment plan","bullets":["Usually 2–4 sessions, 4 weeks apart","Results progressive over 6–12 weeks"]},
        {"title":"Common side effects","bullets":["Significant swelling for up to 1 week","Bruising","Tenderness and warmth","Itching","Firmness in the treated area"]},
        {"title":"Risks","bullets":["Infection","Allergic reaction","Skin irregularity or dimpling","Nerve irritation","Persistent nodules","Unsatisfactory result"]},
        {"title":"Contraindications","bullets":["Pregnant or breastfeeding","BMI > 30 (assess case-by-case)","Autoimmune disease","Diabetes (uncontrolled)","Bleeding disorders","Allergy to ingredients (e.g. soy for some products)"]},
        {"title":"Aftercare","bullets":["Wear compression if advised","Hydrate well","Light walking encouraged; avoid heavy exercise 48 hours","No alcohol 24 hours","Avoid heat for 1 week"]}
      ]
    },
    {
      "name": "PRP / Vampire Facial Consent",
      "treatment_type": "prp",
      "summary": "Consent for platelet-rich plasma treatments to face/scalp.",
      "sections": [
        {"title":"About PRP","body":"A small blood sample is drawn, spun in a centrifuge and the platelet-rich plasma is injected or applied with microneedling to stimulate regeneration."},
        {"title":"Treatment plan","bullets":["Usually 3 sessions, 4–6 weeks apart","Maintenance every 6–12 months"]},
        {"title":"Common side effects","bullets":["Redness and swelling 24–72 hours","Bruising","Tenderness"]},
        {"title":"Risks","bullets":["Infection","Allergic reaction (to anticoagulant)","Bruising or haematoma","Temporary worsening of shedding (hair PRP)"]},
        {"title":"Contraindications","bullets":["Blood disorders","Active infection","Pregnant or breastfeeding","Use of blood thinners","Cancer or chemotherapy"]},
        {"title":"Aftercare","bullets":["No make-up 24 hours","Avoid exercise, alcohol, heat 24 hours","Daily SPF50 for 1 week"]}
      ]
    },
    {
      "name": "Hair PRP / Hair Restoration Consent",
      "treatment_type": "hair_prp",
      "summary": "Consent for scalp PRP for hair loss.",
      "sections": [
        {"title":"About the treatment","body":"Platelet-rich plasma is injected into the scalp to stimulate hair follicles and improve hair density."},
        {"title":"Treatment plan","bullets":["3–6 sessions, 4 weeks apart","Maintenance every 3–6 months","Visible results from 3–6 months"]},
        {"title":"Side effects","bullets":["Scalp tenderness 24–48 hours","Redness, swelling","Temporary shedding"]},
        {"title":"Risks","bullets":["Infection","Bleeding","Allergic reaction","Unsatisfactory result"]},
        {"title":"Contraindications","bullets":["Blood disorders","Pregnancy or breastfeeding","Active scalp infection","Cancer / chemotherapy"]},
        {"title":"Aftercare","bullets":["Do not wash hair for 24 hours","Avoid heat styling 48 hours","No swimming / sauna 48 hours","Avoid alcohol 24 hours"]}
      ]
    },
    {
      "name": "Tear Trough Filler Consent",
      "treatment_type": "tear_trough",
      "summary": "Consent for hyaluronic acid filler to the tear trough (under-eye).",
      "sections": [
        {"title":"About the treatment","body":"A soft hyaluronic acid filler is placed under the eye to reduce hollowness and shadowing. This is a delicate area and requires expert assessment."},
        {"title":"Expected results","bullets":["Immediate improvement","Full result at 2–4 weeks","Longevity 9–18 months"]},
        {"title":"Common side effects","bullets":["Swelling and bruising for up to 2 weeks","Tenderness","Temporary puffiness"]},
        {"title":"Risks","bullets":["Persistent swelling","Tyndall effect (blue-grey tint)","Lumps requiring dissolving","Vascular occlusion — rare but serious, including risk to vision","Migration"]},
        {"title":"Contraindications","bullets":["Severe under-eye bags requiring surgery","Active infection or inflammation","Autoimmune flare","Pregnancy / breastfeeding"]},
        {"title":"Aftercare","bullets":["Sleep elevated for 2 nights","No exercise 24–48 hours","Avoid alcohol 24 hours","Do not massage","Cold compress if swollen"]}
      ]
    },
    {
      "name": "Hyperhidrosis (Excess Sweating) Consent",
      "treatment_type": "hyperhidrosis",
      "summary": "Consent for botulinum toxin treatment of excessive sweating.",
      "sections": [
        {"title":"About the treatment","body":"Botulinum toxin is injected into the skin to temporarily block the nerves that trigger sweat glands. Common areas: underarms, palms, soles, forehead, scalp."},
        {"title":"Expected results","bullets":["Onset 5–14 days","Significant reduction in sweating","Duration 4–7 months"]},
        {"title":"Side effects","bullets":["Mild bruising","Tenderness","Compensatory sweating elsewhere"]},
        {"title":"Risks","bullets":["Temporary weakness (hand/grip if palms treated)","Allergic reaction","Infection","Asymmetric result"]},
        {"title":"Contraindications","bullets":["Pregnant or breastfeeding","Neuromuscular disorders","Allergy to botulinum toxin","Active infection at site"]},
        {"title":"Aftercare","bullets":["Avoid antiperspirant 24 hours","No shaving treated area 24 hours","No exercise or saunas 24 hours"]}
      ]
    },
    {
      "name": "Masseter (Jaw Slimming / Bruxism) Consent",
      "treatment_type": "masseter",
      "summary": "Consent for botulinum toxin into the masseter muscle.",
      "sections": [
        {"title":"About the treatment","body":"Botulinum toxin is injected into the masseter muscle to reduce its size and relieve clenching/grinding (bruxism). Cosmetic benefit is a softer jawline."},
        {"title":"Expected results","bullets":["Reduced clenching within 2 weeks","Visible slimming over 8–12 weeks","Duration 4–6 months"]},
        {"title":"Side effects","bullets":["Bruising","Temporary chewing fatigue","Mild asymmetry"]},
        {"title":"Risks","bullets":["Smile asymmetry if product spreads","Paradoxical bulging","Cheek hollowing with repeated use","Need for top-up"]},
        {"title":"Contraindications","bullets":["Pregnancy / breastfeeding","Neuromuscular disorders","Allergy to botulinum toxin"]},
        {"title":"Aftercare","bullets":["Stay upright 4 hours","Avoid massaging area","No exercise / alcohol 24 hours"]}
      ]
    },
    {
      "name": "Microblading / Cosmetic Tattoo Consent",
      "treatment_type": "smp",
      "summary": "Consent for semi-permanent cosmetic tattooing (brows / lips / scalp).",
      "sections": [
        {"title":"About the treatment","body":"Pigment is implanted into the upper layers of the skin to enhance brows, lips, eyeliner or scalp. Results last 1–3 years and may require touch-ups."},
        {"title":"Expected experience","bullets":["Top-up at 6–8 weeks is essential","Colour appears darker initially and softens 30–50%","Scabbing and itching during healing"]},
        {"title":"Risks","bullets":["Infection","Allergic reaction to pigment / anaesthetic","Uneven pigment retention","Scarring","Pigment migration","Colour change over time"]},
        {"title":"Contraindications","bullets":["Pregnancy / breastfeeding","Keloid scarring","Active skin condition at site","On blood thinners","Recent botox/filler near area","Diabetes (uncontrolled)"]},
        {"title":"Aftercare","bullets":["Keep area dry 7–10 days","No make-up on area until healed","No sun, swimming or saunas 2 weeks","Do not pick scabs","Apply provided balm sparingly"]}
      ]
    },
    {
      "name": "LED Light Therapy Consent",
      "treatment_type": "led",
      "summary": "Consent for LED phototherapy (red / blue / NIR).",
      "sections": [
        {"title":"About the treatment","body":"Low-level LED light is applied to the skin to reduce inflammation, target acne bacteria and stimulate collagen. Painless and non-invasive."},
        {"title":"Side effects","bullets":["Mild warmth","Temporary redness","Dryness"]},
        {"title":"Risks","bullets":["Eye strain if eye protection not used","Headache","Rare photosensitive reaction"]},
        {"title":"Contraindications","bullets":["Photosensitising medication","Active skin cancer at site","Epilepsy (with flashing lights)","Pregnancy (precaution)"]},
        {"title":"Aftercare","bullets":["Apply SPF50","Hydrate skin","Avoid retinoids 24 hours"]}
      ]
    },
    {
      "name": "Mesotherapy Consent",
      "treatment_type": "mesotherapy",
      "summary": "Consent for injectable vitamin / amino acid mesotherapy.",
      "sections": [
        {"title":"About the treatment","body":"A blend of vitamins, amino acids and hyaluronic acid is delivered into the skin via micro-injections to improve hydration, glow and condition."},
        {"title":"Treatment plan","bullets":["Course of 3–6 sessions, 2 weeks apart","Maintenance monthly or as advised"]},
        {"title":"Side effects","bullets":["Redness, bruising, swelling","Small bumps that settle 24–48 hours","Mild itching"]},
        {"title":"Risks","bullets":["Infection","Allergic reaction","Pigmentation changes"]},
        {"title":"Contraindications","bullets":["Pregnancy / breastfeeding","Active skin infection","Allergy to ingredients","Autoimmune flare"]},
        {"title":"Aftercare","bullets":["No make-up 12 hours","Avoid exercise, alcohol, heat 24 hours","Daily SPF50"]}
      ]
    },
    {
      "name": "B12 Injection Consent",
      "treatment_type": "vitamin",
      "summary": "Consent for intramuscular vitamin B12 injection.",
      "sections": [
        {"title":"About the treatment","body":"Hydroxocobalamin or cyanocobalamin is injected intramuscularly to support energy, mood and red-blood-cell formation in people with low B12 or symptoms."},
        {"title":"Side effects","bullets":["Injection site tenderness","Bruising","Mild headache or nausea"]},
        {"title":"Risks","bullets":["Allergic reaction (rare)","Infection at site","Hypokalaemia in severely deficient patients"]},
        {"title":"Contraindications","bullets":["Known allergy to cobalt or B12","Leber''s disease","Pregnancy (use only if clinically indicated)"]},
        {"title":"Aftercare","bullets":["Keep site clean","Mild discomfort can be managed with paracetamol","Report any rash, breathlessness or swelling immediately"]}
      ]
    },
    {
      "name": "IV Vitamin Drip Consent",
      "treatment_type": "iv_drip",
      "summary": "Consent for intravenous vitamin / hydration infusion.",
      "sections": [
        {"title":"About the treatment","body":"A blend of fluids, vitamins, minerals and antioxidants is delivered directly into a vein over 30–60 minutes."},
        {"title":"Side effects","bullets":["Cool sensation along the vein","Mild bruising at cannula site","Light-headedness","Vitamin taste in mouth"]},
        {"title":"Risks","bullets":["Infection at site","Phlebitis / vein irritation","Allergic reaction","Extravasation (leakage)","Electrolyte disturbance"]},
        {"title":"Contraindications","bullets":["Kidney or heart failure","Pregnancy (unless clinically indicated)","G6PD deficiency (for high-dose vitamin C)","Allergy to any component"]},
        {"title":"Aftercare","bullets":["Hydrate well","Keep plaster on for 2 hours","Avoid heavy lifting with that arm for 4 hours","Report any redness, swelling or pain"]}
      ]
    },
    {
      "name": "Photo & Image Use Consent",
      "treatment_type": "photo_consent",
      "summary": "Per-use consent for clinical and marketing photography.",
      "sections": [
        {"title":"Why we take photos","body":"Clinical photographs are an important part of safe practice — they document your starting point, track progress and protect both patient and practitioner."},
        {"title":"How photos may be used","bullets":["Stored privately in your clinical record","Shown to you for review","Shared anonymously for case discussion with colleagues"]},
        {"title":"Optional additional uses","body":"You can tick which of the following you are happy with. You can withdraw permission at any time in writing.","bullets":["Social media (e.g. Instagram, Facebook, TikTok)","Marketing & website","Showing other patients during consultations","Training, conferences and education","Print materials (brochures, posters)"]},
        {"title":"Your rights","bullets":["You may decline any or all optional uses","You may withdraw consent at any time","Already-published images cannot always be removed from third-party platforms"]}
      ]
    },
    {
      "name": "General Aesthetic Treatment Consent (catch-all)",
      "treatment_type": "general",
      "summary": "Generic consent for any aesthetic procedure not covered by a specific form.",
      "sections": [
        {"title":"Acknowledgement","body":"I confirm the treatment has been explained to me, including the procedure, alternatives, expected results, possible side effects and risks. I have had the opportunity to ask questions."},
        {"title":"Medical history","body":"I confirm the medical information I have provided is accurate and complete to the best of my knowledge. I will inform my practitioner of any changes."},
        {"title":"Results & expectations","bullets":["No specific result is guaranteed","Further treatments may be needed","Maintenance may be required","Individual response varies"]},
        {"title":"Risks","body":"I understand all aesthetic treatments carry possible risks including but not limited to: pain, bruising, swelling, infection, allergic reaction, pigmentation change, scarring, asymmetry and an unsatisfactory cosmetic outcome."},
        {"title":"Aftercare & follow-up","body":"I agree to follow the aftercare instructions provided and to contact the clinic if I have any concerns following treatment."}
      ]
    }
  ]'::jsonb;
  v_item jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_rows) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.consent_templates
      WHERE is_system = true AND name = v_item->>'name'
    ) THEN
      INSERT INTO public.consent_templates (
        profile_id, name, treatment_type, body_markdown, requires_signature, is_system, sections, summary
      ) VALUES (
        NULL,
        v_item->>'name',
        v_item->>'treatment_type',
        COALESCE(v_item->>'summary', v_item->>'name'),
        true,
        true,
        v_item->'sections',
        v_item->>'summary'
      );
    END IF;
  END LOOP;
END
$seed$;
