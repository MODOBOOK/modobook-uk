## Goal

Make customizations on the practitioner side actually flow through to the public booking page, and add the new controls you asked for. Priority is the welcome card + Get-in-touch tiles.

## 1. Fix existing customizations that aren't applying

Welcome card, contact chips, fonts/menu, hero/carousel all have DB fields and dashboard inputs but several show inconsistent behaviour on the public page. I will:

- **Welcome card**: make every dashboard control take effect on `/m/:slug` — size, mobile size, position (overlap vs below), background (solid/glass/gradient), opacity, blur, border colour/width/radius, padding, shadow. Also fix the "wide banner mobile-only" fallback so the desktop preview matches the mobile preview when both are set to wide.
- **Contact chips**: today the SMS/WhatsApp/Instagram/Facebook toggles only show inside the compact pill. I'll also wire them into the medium card (and the Get-in-touch tile grid already uses them — confirmed).
- **Show contact chips master toggle**: today this only hides the Get-in-touch tile section. I'll also hide chips in the welcome card when it's off.
- **Fonts**: confirm the heading/body font from the dashboard is applied to every heading on the booking page (some sections still inherit defaults). Add `Syne` to both the loaded Google Fonts link and the FONTS picker since it's in the Warm Sand preset.
- **Hero / carousel**: confirm the carousel toggle + uploaded URLs render the rotating gallery instead of the static hero, and that `hero_image_url` from the dashboard mirrors to the public page.

## 2. New customizations

All added as columns on `clinic_theme`, exposed in the Branding dashboard, and applied on `/m/:slug`.

### Header bar
- `header_sticky` (default on)
- `header_logo_size` (small / medium / large)
- `header_show_name` toggle
- `header_show_tagline` toggle (today shows by default)
- `header_button_label` (rename "Book")

### Hero
- `hero_height` (short / medium / tall)
- `hero_overlay_opacity` (0–80%)
- `hero_overlay_color` (default black)
- `hero_text_alignment` (left / center / right)
- `hero_show_text` toggle (some practitioners want a pure image hero)

### Buttons (Book + contact tiles + Get-in-touch)
- `button_color` (defaults to primary)
- `button_text_color`
- `button_radius` (rounded-md / rounded-xl / pill)
- `button_size` (sm / md / lg)
- `button_uppercase` toggle

### Spacing & density
- `page_density` (compact / cozy / spacious) — adjusts section spacing and card padding across the booking page
- `section_gap` (sm / md / lg)

### Get-in-touch tiles
- `contact_tile_layout` (grid / horizontal-list)
- `contact_tile_icon_size` (sm / md / lg)
- `contact_tile_bg_color`
- `contact_tile_border_color`

## 3. Technical changes

1. **Migration**: add the columns above to `clinic_theme` with sensible defaults.
2. **`src/lib/theme.functions.ts`**: extend `ClinicThemeInput` so the new fields persist.
3. **`src/routes/_authenticated/dashboard.branding.tsx`**: add a "Header & hero", "Buttons", "Spacing", and "Contact tiles" section with the new inputs. Keep the existing layout.
4. **`src/routes/m.$slug.index.tsx`**: read every new field from `theme`, apply to header / hero / contact tiles / Book buttons; fix the welcome-card chip rendering and master `showContact` behaviour; add `Syne` to root fonts; wire density to the section spacing.
5. **`src/lib/theme-presets.ts`**: include the new fields in each preset so picking a preset still produces a coherent look.

## 4. Verification

Drive Playwright headless against `localhost:8080/m/aestheticsbynurseryan` (mobile viewport 402×717) and capture before/after screenshots after toggling each new control through the dashboard.

## Out of scope

- New backend logic for bookings
- Per-section custom HTML
- Customising the consultation wizard pages
