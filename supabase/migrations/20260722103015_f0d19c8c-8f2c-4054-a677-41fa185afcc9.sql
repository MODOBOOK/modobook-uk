INSERT INTO public.consent_templates (name, treatment_type, summary, sections, is_system, requires_signature, profile_id)
SELECT
  $CT$CO2 Fractional Laser Consent$CT$,
  $CT$laser$CT$,
  $CT$Ablative fractional CO2 laser resurfacing for skin texture, scarring, pigmentation and fine lines.$CT$,
  $CT$[
    {"title":"What is CO2 fractional laser?","body":"A fractional ablative CO2 laser delivers columns of 10,600nm energy into the skin, vaporising microscopic zones of tissue while leaving surrounding skin intact. This triggers wound healing, collagen remodelling and skin resurfacing over the following weeks and months."},
    {"title":"Common indications","bullets":["Fine lines and wrinkles","Sun damage and photoageing","Acne scarring and surgical scars","Uneven texture and enlarged pores","Pigmentation (in suitable skin types)"]},
    {"title":"Expected results","bullets":["Immediate skin tightening effect","Progressive improvement in texture, tone and scarring over 3-6 months","Usually 1-3 sessions depending on depth and indication","Results can last several years with good sun protection"]},
    {"title":"The procedure","bullets":["Full skin assessment, photography and skin-type check (Fitzpatrick)","Pre-treatment with SPF and often a pigment inhibitor for 2-4 weeks","Topical anaesthetic applied 45-60 minutes before","Eye shields worn throughout","Treatment usually 20-45 minutes","Cool air or post-laser mask applied"]},
    {"title":"Downtime","bullets":["Intense heat and stinging for 1-2 hours after","Marked redness and swelling for 2-5 days","Bronzing, micro-crusting and flaking day 3-7","Pink skin for 2-6 weeks","Full remodelling continues 3-6 months"]},
    {"title":"Common side effects","bullets":["Redness, swelling, heat","Bronzing and peeling","Itching during healing","Temporary sensitivity and dryness","Acne flare or milia"]},
    {"title":"Risks","bullets":["Post-inflammatory hyperpigmentation (higher risk in darker skin)","Hypopigmentation (loss of colour, may be permanent)","Prolonged redness","Infection - bacterial, viral (cold-sore reactivation) or fungal","Scarring, including hypertrophic or keloid","Ectropion if treated too close to the lower eyelid","Delayed healing"]},
    {"title":"Cold sore prophylaxis","body":"If you have ever had cold sores, antiviral tablets (for example aciclovir or valaciclovir) are prescribed to start the day before treatment and continue for 5-7 days to reduce the risk of a flare."},
    {"title":"Contraindications","bullets":["Pregnancy or breastfeeding","Isotretinoin (Roaccutane) in the last 6-12 months","Active infection, cold sore or acne in the area","Recent sun exposure or sunbed use","Very tanned skin","Fitzpatrick V-VI (case by case, higher pigment risk)","Keloid or hypertrophic scarring tendency","Autoimmune or connective tissue disease","Photosensitising medication","Recent radiotherapy in the area","Uncontrolled diabetes or immunosuppression"]},
    {"title":"Aftercare summary","bullets":["Keep skin cool, clean and well moisturised","Use the prescribed cleanser and healing balm only","Avoid picking, scratching or peeling flakes","No make-up until fully healed (usually 5-7 days)","Strict SPF 50 daily for a minimum of 8 weeks","Avoid sun, exercise, heat, saunas and swimming pools for 1-2 weeks","Complete any prescribed antiviral course"]},
    {"title":"Alternatives discussed","bullets":["Non-ablative fractional laser","Radiofrequency microneedling","Chemical peels","Microneedling","No treatment"]}
  ]$CT$::jsonb,
  true, true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.consent_templates
  WHERE name = 'CO2 Fractional Laser Consent' AND is_system = true
);

INSERT INTO public.aftercare_templates (name, category, summary, delay_hours, body_html, is_system, show_on_public, profile_id)
SELECT
  $AC$CO2 Fractional Laser aftercare$AC$,
  $AC$Laser$AC$,
  $AC$Downtime 5-7 days - keep cool, moisturised, no picking, strict SPF, complete antivirals.$AC$,
  1,
  $AC$CO2 fractional laser aftercare

Your skin has been treated with a fractional ablative CO2 laser. Expect intense heat, redness and swelling for the first 24 to 72 hours, followed by bronzing, micro-crusting and flaking from around day 3 to day 7. Pink, sensitive skin can persist for several weeks. This is all part of normal healing.

For the first 24 hours use cool compresses (a clean cloth over a bag of frozen peas, ten minutes on and off) to help with heat and swelling. Sleep with your head slightly elevated on a clean pillowcase for the first two nights. Do not apply ice directly to the skin.

Cleanse twice a day with only the gentle cleanser we have recommended, using cool water and clean fingertips - no cloths, flannels or brushes. Pat dry with a clean towel.

Apply the healing balm or occlusive moisturiser we have provided as often as needed to keep the skin comfortable and never allow it to feel dry or tight. Do not use any other product on the skin for the first 5 to 7 days.

Do not pick, scratch, rub or peel any flakes or crusts. Let them come away on their own. Picking is the single biggest cause of scarring and pigment change after laser.

No make-up until the skin has fully re-epithelialised, usually 5 to 7 days. When you do restart, use a fresh, clean product and mineral formulations first.

For at least two weeks avoid strenuous exercise, saunas, steam rooms, hot showers, hot baths, swimming pools and hot tubs. Sweat and chlorinated or shared water increase the risk of infection.

For a minimum of 8 weeks (ideally longer) wear a broad-spectrum SPF 50 every single day and reapply every two hours when outdoors. Wear a wide-brimmed hat. Any UV exposure during healing dramatically increases the risk of pigmentation and can undo your result.

Do not use retinoids, vitamin C, glycolic or salicylic acid, benzoyl peroxide, exfoliants, scrubs, chemical peels, microneedling or any energy-based device on the treated area for at least 4 weeks, or until we have advised you to restart.

If you have been prescribed an antiviral tablet (such as aciclovir or valaciclovir) please complete the full course, even if the skin looks well.

Contact us straight away if you notice spreading redness, worsening pain, pus, yellow crusting, blisters that were not there originally, a fever, or any cold-sore-like tingling or eruptions. These can be signs of infection or a viral flare and need prompt review.$AC$,
  true, true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.aftercare_templates
  WHERE name = 'CO2 Fractional Laser aftercare' AND is_system = true
);