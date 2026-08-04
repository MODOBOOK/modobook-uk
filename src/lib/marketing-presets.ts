// Branded starter layouts for marketing emails. These are plain block-text
// presets — rendering happens through the marketing-broadcast shell, so every
// preset automatically picks up the practitioner's logo and brand colour.

export interface MarketingPreset {
  id: string
  name: string
  description: string
  subject: string
  preheader: string
  /** Body in the simple editor syntax: "# heading", "[BUTTON](url) label", paragraphs. */
  body: string
}

export const MARKETING_PRESETS: MarketingPreset[] = [
  {
    id: 'offer',
    name: 'Seasonal offer',
    description: 'A single, clear promotion with one call to action.',
    subject: 'A little something for you, {{first_name}}',
    preheader: 'A limited-time offer at {{clinic_name}}',
    body: `# Hi {{first_name}},

We're running a short seasonal offer at {{clinic_name}} and wanted you to hear about it first.

# The offer

Describe the treatment, what's included and the saving here. Keep it to two or three lines so it reads well on a phone.

[BUTTON]({{booking_url}}) Book your appointment

Offer ends soon and spaces are limited. If you'd like advice on what's right for you, just reply to this email.`,
  },
  {
    id: 'newsletter',
    name: 'Clinic newsletter',
    description: 'Three short sections plus a closing note — great monthly.',
    subject: 'What\u2019s new at {{clinic_name}}',
    preheader: 'Your monthly update from the clinic',
    body: `# Hello {{first_name}},

Here's a quick round-up of what's happening at {{clinic_name}} this month.

# What's new

Introduce a new treatment, product or piece of kit, and who it suits.

# Clinic notes

Share opening hours, a new location, or a team update.

# Aftercare tip

One practical tip your patients will genuinely use.

[BUTTON]({{booking_url}}) See availability`,
  },
  {
    id: 'rebook',
    name: 'Time for a top-up',
    description: 'Warm nudge for patients due another treatment.',
    subject: 'Ready for your next visit, {{first_name}}?',
    preheader: 'It\u2019s been a little while since your last treatment',
    body: `# Hi {{first_name}},

It's been a while since your {{last_treatment}} with us, and results are usually at their best when treatments are kept topped up.

If you'd like to keep things looking their best, now is a good time to book in.

[BUTTON]({{booking_url}}) Book a top-up

Not sure what you need? Reply to this email and we'll advise.`,
  },
  {
    id: 'launch',
    name: 'New treatment launch',
    description: 'Introduce a new service with benefits and a booking link.',
    subject: 'Introducing something new at {{clinic_name}}',
    preheader: 'A new treatment has just landed',
    body: `# Something new at {{clinic_name}}

Name the treatment and describe it in one welcoming sentence.

# Who it's for

Explain the concerns it addresses and the kind of results patients can expect.

# What to expect

Appointment length, comfort, downtime and how soon results show.

[BUTTON]({{booking_url}}) Book a consultation`,
  },
  {
    id: 'event',
    name: 'Event or open evening',
    description: 'Invite with date, time and place front and centre.',
    subject: 'You\u2019re invited, {{first_name}}',
    preheader: 'An evening at {{clinic_name}}',
    body: `# You're invited

We're hosting an evening at {{clinic_name}} and we'd love to see you there.

# The details

Date, time and location go here. Add anything guests should know, such as parking or bringing a friend.

# On the night

Live demonstrations, exclusive event pricing and time to ask questions.

[BUTTON]({{booking_url}}) Reserve your place

Places are limited, so let us know early.`,
  },
  {
    id: 'welcome',
    name: 'Welcome / thank you',
    description: 'Warm introduction for new patients on your list.',
    subject: 'Welcome to {{clinic_name}}',
    preheader: 'Lovely to have you with us',
    body: `# Welcome, {{first_name}}

Thank you for choosing {{clinic_name}}. We're delighted to have you with us.

# How we work

A short line about your approach — consultation first, honest advice, results that look natural.

# Booking with us

You can see live availability and book online at any time.

[BUTTON]({{booking_url}}) View availability

Any questions at all, just reply — we read every message.`,
  },
]
