-- System consents and aftercare additions (UK aesthetics)
-- Add valuable templates available to all clinicians

WITH new_consents(name, treatment_type, summary, sections) AS (
  VALUES
  ('Structura® (HA Bio-Remodelling) Consent', 'biostimulator',
   'Croma Structura® is a hyaluronic-acid based bio-remodelling / structural filler used for skin quality and mild volume support.',
   '[
     {"title":"What is Structura®?","body":"Structura® is a CE-marked injectable from Croma-Pharma made of highly cross-linked hyaluronic acid designed for structural support and bio-remodelling. It hydrates, lifts and stimulates gradual collagen and elastin remodelling in the surrounding tissue."},
     {"title":"Common treatment areas","bullets":["Cheeks","Jawline","Chin","Temples","Neck and décolletage (as advised)"]},
     {"title":"Expected results","bullets":["Immediate hydration and mild structural lift","Progressive skin-quality improvement over 4–8 weeks","Longevity typically 9–18 months depending on area and metabolism","Top-up sessions may be recommended"]},
     {"title":"The procedure","bullets":["Full face assessment and photography","Skin cleanse and antiseptic prep","Injection by needle or cannula","Massage and moulding as required","Appointment usually 30–45 minutes"]},
     {"title":"Common side effects","bullets":["Redness, swelling, tenderness","Bruising and small injection marks","Temporary lumpiness which usually settles in days"]},
     {"title":"Risks","bullets":["Infection","Allergic reaction","Prolonged swelling","Nodules or granulomas","Asymmetry","Product migration","Vascular occlusion (rare but serious) — treated with hyaluronidase","Blindness (extremely rare)"]},
     {"title":"Contraindications","bullets":["Pregnancy or breastfeeding","Active skin infection or acne at site","Recent dental work (within 2 weeks)","Autoimmune or inflammatory skin disease","Bleeding disorders or anticoagulants (case by case)","Known allergy to HA or lidocaine"]},
     {"title":"Aftercare","bullets":["Avoid touching or massaging the area for 24 hours (unless advised)","No make-up for 12 hours","No alcohol, strenuous exercise, saunas or facials for 24–48 hours","No dental work for 2 weeks","Report severe pain, skin colour change, blistering or vision changes immediately"]}
   ]'::jsonb),

  ('HArmonyCa™ Hybrid Filler Consent', 'biostimulator',
   'Allergan HArmonyCa™ combines calcium hydroxylapatite (CaHA) with hyaluronic acid for immediate lift and collagen stimulation.',
   '[
     {"title":"What is HArmonyCa™?","body":"HArmonyCa™ is a hybrid injectable containing calcium hydroxylapatite microspheres suspended in cross-linked hyaluronic acid. It provides immediate lifting while stimulating new collagen production over the following months."},
     {"title":"Common treatment areas","bullets":["Lower face and jawline","Cheeks","Chin","Pre-jowl area"]},
     {"title":"Expected results","bullets":["Immediate lifting effect from the HA component","Progressive skin firmness from CaHA-driven collagen stimulation over 3–6 months","Results typically last 12–18 months"]},
     {"title":"The procedure","bullets":["Consultation and facial assessment","Skin cleanse and antiseptic","Injection typically by cannula in the subdermal plane","Massage and moulding","Session usually 30–45 minutes"]},
     {"title":"Common side effects","bullets":["Redness, swelling, tenderness","Bruising","Temporary firmness or small nodules"]},
     {"title":"Risks","bullets":["Infection","Persistent nodules — CaHA cannot be dissolved with hyaluronidase","Allergic reaction","Asymmetry","Vascular occlusion (rare but serious)","Blindness (extremely rare)"]},
     {"title":"Contraindications","bullets":["Pregnancy or breastfeeding","Active infection at site","Autoimmune disease","Bleeding disorders","History of keloid scarring","Allergy to any component"]},
     {"title":"Aftercare","bullets":["Avoid make-up 12 hours","No exercise, alcohol, heat treatments 24–48 hours","No facials, peels or energy-based treatments for 2 weeks","Report severe pain, colour change, blistering or vision problems immediately"]}
   ]'::jsonb),

  ('Radiesse® (Calcium Hydroxylapatite) Consent', 'biostimulator',
   'Radiesse® is a CaHA-based collagen stimulating filler for volume restoration and skin tightening.',
   '[
     {"title":"What is Radiesse®?","body":"Radiesse® is an injectable made of calcium hydroxylapatite microspheres in a gel carrier. It provides immediate volume and stimulates collagen production over several months. It cannot be dissolved with hyaluronidase."},
     {"title":"Common treatment areas","bullets":["Cheeks","Jawline and chin","Hands","Décolletage","Neck (hyper-diluted)"]},
     {"title":"Expected results","bullets":["Immediate volume","Skin quality and firmness improvement over 3–6 months","Longevity typically 12–18 months"]},
     {"title":"Common side effects","bullets":["Redness, swelling, bruising","Tenderness","Temporary firmness"]},
     {"title":"Risks","bullets":["Infection","Nodules — not dissolvable","Asymmetry","Vascular occlusion (rare)","Blindness (extremely rare)"]},
     {"title":"Contraindications","bullets":["Pregnancy or breastfeeding","Active infection","Autoimmune disease","Bleeding disorders","Keloid tendency"]},
     {"title":"Aftercare","bullets":["No make-up 12 hours","No exercise, heat or alcohol 24–48 hours","No facials or energy-based treatments 2 weeks","Report severe pain, colour change or vision issues immediately"]}
   ]'::jsonb),

  ('Ellansé® (Polycaprolactone) Consent', 'biostimulator',
   'Ellansé® is a collagen-stimulating filler made from polycaprolactone microspheres, offering long-lasting results.',
   '[
     {"title":"What is Ellansé®?","body":"Ellansé® contains polycaprolactone (PCL) microspheres in a CMC gel carrier. It gives immediate correction and stimulates the body''s own collagen for long-lasting results. It is not dissolvable."},
     {"title":"Available durations","bullets":["S — approx 1 year","M — approx 2 years","L — approx 3 years","E — approx 4 years"]},
     {"title":"Common treatment areas","bullets":["Cheeks","Temples","Jawline","Chin","Nasolabial folds"]},
     {"title":"Common side effects","bullets":["Swelling, bruising, tenderness","Temporary lumpiness"]},
     {"title":"Risks","bullets":["Infection","Persistent nodules — not dissolvable","Asymmetry","Vascular occlusion (rare)","Blindness (extremely rare)"]},
     {"title":"Contraindications","bullets":["Pregnancy or breastfeeding","Active infection or acne at site","Autoimmune disease","Bleeding disorders","Keloid tendency"]},
     {"title":"Aftercare","bullets":["No make-up 12 hours","No exercise, heat, alcohol 24–48 hours","No facials or energy treatments 2 weeks","Report severe pain, colour change or vision problems immediately"]}
   ]'::jsonb),

  ('Platelet-Rich Fibrin (PRF) Consent', 'prp',
   'PRF uses your own blood, spun to concentrate fibrin, platelets and growth factors to support skin regeneration.',
   '[
     {"title":"What is PRF?","body":"A small blood sample is taken and spun at low speed with no anticoagulant to produce a fibrin-rich matrix containing platelets, leukocytes and growth factors. This is injected or applied topically after microneedling to stimulate healing and collagen."},
     {"title":"Common uses","bullets":["Facial skin quality","Under-eye tear troughs","Hair restoration","Post-microneedling"]},
     {"title":"Expected results","bullets":["Progressive improvement over 4–12 weeks","Usually 3–4 sessions monthly for best results","Maintenance every 6–12 months"]},
     {"title":"Common side effects","bullets":["Bruising at blood draw site","Redness, swelling, tenderness at treated area","Mild lumpiness that settles"]},
     {"title":"Risks","bullets":["Infection","Allergic reaction to topical anaesthetic","Prolonged bruising","Vascular occlusion (rare)"]},
     {"title":"Contraindications","bullets":["Pregnancy or breastfeeding","Blood disorders or anti-coagulant therapy","Active infection","Autoimmune or immunosuppressive conditions","Active cancer"]},
     {"title":"Aftercare","bullets":["No make-up 12 hours","Avoid heat, exercise, alcohol 24 hours","No active skincare (retinoids, acids) for 3–5 days","SPF daily"]}
   ]'::jsonb),

  ('Exosome Therapy Consent', 'exosomes',
   'Topical or micro-channelled exosomes containing growth factors and signalling molecules to support skin repair.',
   '[
     {"title":"What are exosomes?","body":"Exosomes are extracellular vesicles containing growth factors, peptides and signalling molecules. In UK aesthetic practice they are applied topically, typically immediately after microneedling or an energy-based treatment, to support recovery and skin quality. Injectable use is not permitted in the UK."},
     {"title":"Expected results","bullets":["Reduced downtime after microneedling / laser","Progressive improvement in skin quality","Best in a course of 3–6 treatments"]},
     {"title":"Common side effects","bullets":["Redness and mild swelling from the accompanying procedure","Temporary sensitivity"]},
     {"title":"Risks","bullets":["Allergic reaction","Infection if aftercare not followed","Uncertain long-term data — informed choice"]},
     {"title":"Contraindications","bullets":["Pregnancy or breastfeeding","Active skin infection","Autoimmune disease","Active cancer","Immunosuppression"]},
     {"title":"Aftercare","bullets":["Keep skin clean, no make-up 12–24 hours","No active skincare 3–5 days","SPF daily","Avoid heat and heavy exercise 24 hours"]}
   ]'::jsonb),

  ('RF Microneedling Consent', 'rf_microneedling',
   'Radiofrequency microneedling delivers heat energy into the dermis through fine needles to remodel collagen.',
   '[
     {"title":"What is RF microneedling?","body":"A device uses fine insulated or non-insulated needles to deliver radiofrequency energy into the dermis. This creates controlled micro-injuries and heat that stimulate collagen remodelling and skin tightening."},
     {"title":"Common treatment areas","bullets":["Face","Neck","Décolletage","Body — stretch marks, scars, laxity"]},
     {"title":"Expected results","bullets":["Progressive tightening and texture improvement over 3–6 months","Typically 3 sessions 4–6 weeks apart","Maintenance annually"]},
     {"title":"Common side effects","bullets":["Redness up to 48 hours","Pinpoint bleeding","Swelling and warmth","Grid-pattern marks that fade in days"]},
     {"title":"Risks","bullets":["Post-inflammatory pigmentation (higher in darker skin types)","Infection or cold sore reactivation","Scarring (rare)","Burns (rare)","Temporary numbness"]},
     {"title":"Contraindications","bullets":["Pregnancy","Active infection, acne, cold sores","Recent isotretinoin (within 6 months)","Metal implants in treatment area","Pacemaker or implanted electronic devices","Keloid tendency","Recent sun exposure or tan"]},
     {"title":"Aftercare","bullets":["Gentle cleanse only for 24 hours","No make-up 24 hours","SPF 50 daily","No exercise, heat, saunas 48 hours","No actives (retinoids, acids) 5–7 days"]}
   ]'::jsonb),

  ('Laser Hair Removal Consent', 'laser_hair_removal',
   'Selective photothermolysis targets the hair follicle to reduce hair growth over a course of treatments.',
   '[
     {"title":"How it works","body":"Laser or IPL energy is absorbed by melanin in the hair, damaging the follicle. Because only actively growing hairs are affected, a course of treatments is required."},
     {"title":"Expected results","bullets":["Typically 6–10 sessions 4–8 weeks apart","Approx 70–90% hair reduction — not permanent removal","Maintenance may be required","Hormonal areas (face) less predictable"]},
     {"title":"Common side effects","bullets":["Redness and mild swelling","Perifollicular oedema","Temporary tenderness"]},
     {"title":"Risks","bullets":["Burns and blistering","Pigmentary change — hyper or hypopigmentation","Paradoxical hair growth (rare, face/neck)","Scarring (rare)","Eye injury without protection"]},
     {"title":"Contraindications","bullets":["Pregnancy","Recent tan or sunbed use","Photosensitising medication","Active infection or cold sores","Recent isotretinoin","Tattoos or dark moles in area","History of melanoma"]},
     {"title":"Aftercare","bullets":["Cool the area, SPF 50 daily","No hot showers, saunas, exercise 24–48 hours","No plucking, waxing or threading between sessions — shaving only","No perfumes or deodorants for 24 hours"]}
   ]'::jsonb),

  ('IPL Photo-Rejuvenation Consent', 'ipl',
   'Intense pulsed light targets pigment and vascular concerns to improve overall skin tone.',
   '[
     {"title":"What is IPL?","body":"IPL delivers broadband light energy absorbed by pigment and haemoglobin. It treats sun damage, freckles, redness and rosacea, and improves overall skin tone."},
     {"title":"Expected results","bullets":["3–5 sessions 4 weeks apart","Pigment darkens then flakes off in 1–2 weeks","Redness reduces gradually"]},
     {"title":"Common side effects","bullets":["Warmth, redness, swelling","Temporary darkening of pigmented spots"]},
     {"title":"Risks","bullets":["Burns and blistering","Hyper or hypopigmentation","Scarring (rare)","Eye injury without protection","Cold sore reactivation"]},
     {"title":"Contraindications","bullets":["Tanned or dark skin (Fitzpatrick V–VI)","Pregnancy","Photosensitising medication","Recent isotretinoin","Active infection","History of melanoma"]},
     {"title":"Aftercare","bullets":["SPF 50 daily","No heat, sauna, exercise 48 hours","Do not pick flaking pigment","Gentle skincare only 5–7 days"]}
   ]'::jsonb),

  ('Dermaplaning Consent', 'dermaplaning',
   'Manual exfoliation using a sterile blade to remove dead skin and vellus hair.',
   '[
     {"title":"What is dermaplaning?","body":"A sterile surgical blade is used at a shallow angle to remove the outermost layer of dead skin and fine vellus hair, leaving skin smoother and brighter and improving product absorption."},
     {"title":"Common side effects","bullets":["Mild redness for a few hours","Skin sensitivity"]},
     {"title":"Risks","bullets":["Nicks or superficial cuts","Breakout if pores are stimulated","Post-inflammatory pigmentation (rare)"]},
     {"title":"Contraindications","bullets":["Active acne (cystic/pustular)","Active cold sores or infection","Rosacea flare","Recent isotretinoin (6 months)","Very sensitive or thin skin"]},
     {"title":"Aftercare","bullets":["No make-up for a few hours","SPF 50 daily","No actives (retinoids, acids) 48 hours","No sauna, heavy exercise, heat 24 hours"]}
   ]'::jsonb),

  ('HydraFacial / Hydrating Facial Consent', 'facial',
   'Multi-step cleanse, gentle exfoliation, painless extraction and hydrating serum infusion.',
   '[
     {"title":"What it involves","body":"A device-based facial combining cleansing, mild acid exfoliation, painless vacuum extraction and infusion of hydrating serums. Suitable for most skin types with minimal downtime."},
     {"title":"Common side effects","bullets":["Mild redness","Temporary tightness"]},
     {"title":"Risks","bullets":["Sensitivity or breakout","Reaction to serum ingredients"]},
     {"title":"Contraindications","bullets":["Active cold sores or infection","Sunburn or very sensitive skin","Recent isotretinoin (6 months)","Known allergy to serum ingredients"]},
     {"title":"Aftercare","bullets":["No make-up 4 hours","SPF 50 daily","No actives 24 hours","Hydrate well"]}
   ]'::jsonb),

  ('Skin Tag / Mole Cosmetic Removal Consent', 'lesion_removal',
   'Cosmetic removal of benign skin lesions by cautery, plasma, cryotherapy or similar.',
   '[
     {"title":"Important","body":"Cosmetic lesion removal is only appropriate for lesions clinically judged benign. Any lesion showing signs suspicious for malignancy must be referred to a GP or dermatologist and will not be treated here."},
     {"title":"Common side effects","bullets":["Redness, swelling, scabbing","Temporary discomfort","Small scab for 5–10 days"]},
     {"title":"Risks","bullets":["Scarring — hypertrophic or keloid","Pigmentary change","Infection","Incomplete removal or recurrence","Missed diagnosis of skin cancer if lesion is not benign"]},
     {"title":"Contraindications","bullets":["Suspicious or changing lesion","Bleeding disorders","Active infection","Pregnancy (case by case)","Pacemaker (for cautery/plasma)","Keloid tendency"]},
     {"title":"Aftercare","bullets":["Keep dry 24 hours","Do not pick the scab","Antiseptic as advised","SPF 50 for 3 months to prevent pigmentation","Report signs of infection"]}
   ]'::jsonb),

  ('Microsclerotherapy (Thread Veins) Consent', 'microsclerotherapy',
   'Injection of sclerosant into small leg veins to close and fade them.',
   '[
     {"title":"What it involves","body":"A very fine needle is used to inject a sclerosant into thread veins on the legs, causing them to close and be reabsorbed over weeks to months."},
     {"title":"Expected results","bullets":["Improvement over 4–8 weeks","Multiple sessions usually needed","Not all veins will respond","New veins may develop over time"]},
     {"title":"Common side effects","bullets":["Bruising","Brown pigmentation lines that usually fade over months","Itching, aching for 24 hours"]},
     {"title":"Risks","bullets":["Persistent pigmentation","Matting — new fine red vessels","Skin ulceration (rare)","Allergic reaction","Deep vein thrombosis (very rare)"]},
     {"title":"Contraindications","bullets":["Pregnancy or breastfeeding","History of DVT or clotting disorders","Active infection","Immobility","Allergy to sclerosant"]},
     {"title":"Aftercare","bullets":["Wear compression stockings as advised (often 1–2 weeks)","Walk regularly, avoid long standing or sitting","No hot baths, saunas, sunbeds 2 weeks","Avoid heavy exercise 48 hours"]}
   ]'::jsonb),

  ('PRP Hair Restoration Consent', 'prp',
   'Platelet-rich plasma injected into the scalp to support hair follicles and reduce shedding.',
   '[
     {"title":"How it works","body":"Blood is drawn and centrifuged to concentrate platelets and growth factors, which are injected into the scalp to support follicle function and slow hair loss."},
     {"title":"Expected results","bullets":["Reduced shedding within weeks","Improved density over 3–6 months","Typically 3–4 initial sessions monthly, then maintenance every 3–6 months","Not a cure — results depend on cause of hair loss"]},
     {"title":"Common side effects","bullets":["Scalp tenderness","Mild swelling or bruising","Headache 24 hours"]},
     {"title":"Risks","bullets":["Infection","Allergic reaction","Temporary shedding after first session"]},
     {"title":"Contraindications","bullets":["Pregnancy or breastfeeding","Blood disorders / anticoagulants","Active scalp infection or psoriasis flare","Immunosuppression","Active cancer"]},
     {"title":"Aftercare","bullets":["Do not wash hair for 6 hours","No harsh products 24 hours","Avoid exercise, sauna, alcohol 24 hours","No hair dye or chemical treatments 3 days"]}
   ]'::jsonb),

  ('Photography, Data & Marketing Consent', 'photo_consent',
   'Clinical photography for records and, if you agree, marketing use.',
   '[
     {"title":"Clinical photography","body":"Photographs are taken as part of your medical record to assess results and plan treatment. These are stored securely and are part of your confidential record."},
     {"title":"Marketing use — optional","body":"With your explicit permission we may use anonymised or identifiable images on our website, social media or in printed materials. You can withdraw permission at any time and we will remove new uses of the image, though we may not be able to recall material already distributed."},
     {"title":"Your rights","bullets":["You may refuse marketing use without affecting your treatment","You may withdraw consent at any time in writing","You may request a copy of images held about you","You may request deletion in line with our retention policy"]},
     {"title":"Please initial your choice","bullets":["I consent to clinical photography for my records","I consent to anonymised use in marketing (face not identifiable)","I consent to identifiable use in marketing","I do NOT consent to any marketing use"]}
   ]'::jsonb),

  ('Data Protection & GDPR Consent', 'gdpr',
   'How your personal and medical data is stored, used and shared under UK GDPR.',
   '[
     {"title":"Data we hold","bullets":["Contact and identity details","Medical history and consultations","Treatment records and photographs","Payment records"]},
     {"title":"Lawful basis","body":"We process your data under Article 6(1)(b) (contract) and Article 9(2)(h) (provision of healthcare). Marketing communications require your separate consent."},
     {"title":"Sharing","bullets":["Prescribers when a prescription is required","Insurers if you make a claim","Regulators (NMC, GMC, CQC, HIS as applicable)","Never sold to third parties"]},
     {"title":"Retention","body":"Adult records are held for a minimum of 8 years after your last appointment; children''s records until age 25. Photographs are retained in line with your record."},
     {"title":"Your rights","bullets":["Access your data","Rectification of inaccurate data","Erasure where legally possible","Restrict or object to processing","Complain to the ICO"]}
   ]'::jsonb)
)
INSERT INTO public.consent_templates (name, treatment_type, summary, sections, is_system, requires_signature, profile_id)
SELECT c.name, c.treatment_type, c.summary, c.sections, true, true, NULL
FROM new_consents c
WHERE NOT EXISTS (SELECT 1 FROM public.consent_templates ct WHERE ct.name = c.name AND ct.is_system = true);


-- Aftercare templates
WITH new_aftercare(name, category, summary, delay_hours, body_html) AS (
  VALUES
  ('Structura® aftercare', 'Injectables',
   'Firm bio-remodelling filler — swelling, do not massage, dental precautions.',
   2,
   'Structura aftercare

Structura is a structural bio-remodelling filler. You may notice mild swelling, redness and small bruises at the injection points for the first 24 to 48 hours. Small lumps or firmness are normal in the first week as the product settles.

For the first 24 hours please avoid make-up over the injection points, alcohol, strenuous exercise, saunas, hot showers and steam rooms.

Do not massage or press the area for the first 24 hours unless we have specifically shown you a technique.

For the next two weeks please avoid facials, peels, microneedling, laser and radiofrequency on the treated area, and postpone any dental work.

You can take paracetamol if needed and use a clean cool compress on and off for ten minutes at a time to help with swelling.

Please contact us straight away if you notice severe or worsening pain, the skin turns white or dusky, blistering, hard nodules that persist beyond two weeks, signs of infection, or any change in your vision.'),

  ('HArmonyCa™ aftercare', 'Injectables',
   'Hybrid CaHA + HA — firmness normal, avoid heat and dental work.',
   2,
   'HArmonyCa aftercare

HArmonyCa gives an immediate lift and continues to work by stimulating collagen over the next three to six months. Some firmness is normal in the first two weeks.

For the first 24 hours avoid make-up over the injection points, alcohol, exercise, saunas, hot showers and steam rooms. Do not massage the area unless we have shown you.

For two weeks avoid facials, peels, microneedling, laser, radiofrequency and dental work.

Use a cool compress for swelling and paracetamol for discomfort if needed.

Contact us immediately if you have severe or worsening pain, the skin turns white or dusky, blistering, persistent hard nodules, signs of infection, or any change in vision.'),

  ('Ellansé® aftercare', 'Injectables',
   'Long-lasting collagen stimulator — firmness normal, no dental work 2 weeks.',
   2,
   'Ellansé aftercare

Ellansé gives immediate correction and stimulates your own collagen over the following months. Mild swelling, tenderness and small bruises at the injection points are normal in the first 48 hours.

For the first 24 hours avoid make-up over the injection points, alcohol, exercise, saunas, hot showers and steam rooms.

Do not massage the area for 24 hours unless we have shown you a technique.

For two weeks avoid facials, peels, microneedling, laser, radiofrequency and any dental work.

A cool compress and paracetamol can help with any discomfort.

Contact us straight away if you develop severe pain, the skin turns white or dusky, blistering, persistent lumps beyond two weeks, signs of infection, or any change in vision.'),

  ('Platelet-Rich Fibrin (PRF) aftercare', 'Skin',
   'Bruising, keep the skin clean, no actives for 3–5 days.',
   1,
   'PRF aftercare

Your PRF treatment uses your own blood, so allergic reactions are very rare. Some redness, mild swelling and pinpoint bruises are normal for 24 to 48 hours.

For the first 12 hours do not wear make-up over the treated area. Avoid touching your face with unwashed hands.

For 24 hours avoid alcohol, strenuous exercise, saunas, hot showers and steam rooms.

For three to five days use only gentle cleansers and moisturiser. Avoid retinoids, vitamin C, glycolic and salicylic acids, exfoliants and any active treatments.

Wear SPF 50 every day. Sleep on a clean pillowcase for the first two nights.

Contact us if you develop spreading redness, increasing pain, pus, fever, or any change in vision.'),

  ('Exosome aftercare', 'Skin',
   'Post-microneedling exosomes — no make-up 12h, active-free 5 days, SPF daily.',
   0,
   'Exosome aftercare

Exosomes are applied to freshly channelled skin, so your aftercare is the same as microneedling with extra care to keep the skin clean.

For the first 12 to 24 hours do not wear make-up. Rinse with cool water only and pat dry with a clean towel.

For 24 hours avoid alcohol, exercise, saunas, hot showers and steam rooms.

For five to seven days use only gentle cleansers, hyaluronic acid and a bland moisturiser. Avoid retinoids, vitamin C, glycolic and salicylic acids, and any exfoliants.

Wear SPF 50 every day and avoid direct sun for two weeks.

Contact us if you develop spreading redness, worsening pain, blistering, pus, or a fever.'),

  ('Weight loss injection aftercare (Mounjaro / Wegovy)', 'Medical',
   'Injection technique, nausea, hydration, red-flag symptoms.',
   0,
   'Weight loss injection aftercare

Your weekly injection is given into fatty tissue in the tummy, thigh or upper arm. Rotate the site each week to reduce soreness.

It is normal in the first few days to feel nauseous, less hungry, bloated or a little tired. Eat small, protein-rich meals slowly, sip water regularly through the day, and avoid very fatty or fried foods.

If you are being sick, cannot keep fluids down, are constipated for more than a few days, or have severe tummy pain (especially pain radiating to your back), stop the injections and contact us or your GP. These can be signs of dehydration or pancreatitis and need urgent review.

Keep your pen in the fridge until first use, then follow the pen instructions for storage.

Do not increase your dose unless we have advised you to. If you miss a dose, follow the manufacturer''s guidance based on how many days late you are.

Contact us or seek urgent care for severe tummy pain, persistent vomiting, signs of an allergic reaction, or changes in vision.'),

  ('Mesotherapy aftercare', 'Skin',
   'Micro-injections of vitamins/HA — swelling, no make-up 12h, SPF.',
   0,
   'Mesotherapy aftercare

Mesotherapy delivers vitamins, amino acids and hyaluronic acid through many tiny injections. Redness, small bumps and pinpoint bruises are normal for 24 to 48 hours.

For the first 12 hours do not wear make-up over the treated area.

For 24 hours avoid alcohol, exercise, saunas, hot showers and steam rooms.

For five days avoid retinoids, vitamin C, glycolic and salicylic acids, exfoliants, facials, peels and any energy-based treatment.

Wear SPF 50 every day.

Contact us if you develop spreading redness, worsening pain, blistering, pus or fever.'),

  ('Radiesse® aftercare', 'Injectables',
   'Firmness is normal, no massage unless shown, no dental work 2 weeks.',
   2,
   'Radiesse aftercare

Radiesse gives immediate volume and continues to work by stimulating collagen over the following months. Firmness in the area is normal for the first one to two weeks.

For the first 24 hours avoid make-up over the injection points, alcohol, exercise, saunas, hot showers and steam rooms. Do not massage the area unless we have shown you a technique.

For two weeks avoid facials, peels, microneedling, laser, radiofrequency and any dental work.

Use a cool compress and paracetamol if you need it.

Contact us straight away if the skin turns white or dusky, if you develop severe or worsening pain, blistering, persistent lumps beyond two weeks, signs of infection, or any change in vision.')
)
INSERT INTO public.aftercare_templates (name, category, summary, delay_hours, body_html, is_system, show_on_public, profile_id)
SELECT a.name, a.category, a.summary, a.delay_hours, a.body_html, true, true, NULL
FROM new_aftercare a
WHERE NOT EXISTS (SELECT 1 FROM public.aftercare_templates at WHERE at.name = a.name AND at.is_system = true);
