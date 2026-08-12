do $$
declare r record; mid text; html text; txt text; tok text;
logo text := 'https://yfbkbtsxufvxkbpoyjjn.supabase.co/storage/v1/object/sign/clinic-assets/b8118d60-745e-4130-8008-085bab10df35/logo/1782773849006.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kODU4NTc5Yy00MmVjLTQ2NjUtYjI4YS0wZGI3YmI5MmIwMDYiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjbGluaWMtYXNzZXRzL2I4MTE4ZDYwLTc0NWUtNDEzMC04MDA4LTA4NWJhYjEwZGYzNS9sb2dvLzE3ODI3NzM4NDkwMDYucG5nIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4Mjc3Mzg0OSwiZXhwIjoyMDk4MTMzODQ5fQ.p0y8a2nvrk_iaHHK7hHpHIZ42uIjPAL1AKCBTjrRclA';
begin
for r in
  select * from (values
    ('Ryan','rynaesthetics@outlook.com','https://buy.stripe.com/9B65kw6b33LpcjJ6Fa3840e','Sculptra 1 vial','Saturday 29 August at 10:00'),
    ('Ella','lippylikes@gmail.com','https://buy.stripe.com/aFa3cogPH4PtcjJ9Rm3840d','Sculptra 1 vial','Saturday 29 August at 13:00'),
    ('Gary','garyreilly4@hotmail.co.uk','https://buy.stripe.com/00w3cogPHchV5Vl1kQ3840c','3 Areas + Profhilo Maintenance','Thursday 27 August at 15:15')
  ) as t(first_name,email,url,treatment,when_txt)
loop
  select token into tok from public.email_unsubscribe_tokens where email = lower(r.email) limit 1;
  if tok is null then
    tok := gen_random_uuid()::text;
    insert into public.email_unsubscribe_tokens (token, email) values (tok, lower(r.email));
  end if;
  mid := 'dep-link-' || gen_random_uuid()::text;
  html := format($h$<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1f2937"><div style="max-width:560px;margin:0 auto;padding:28px 24px"><div style="text-align:center;padding-bottom:20px"><img src="%s" alt="Aesthetics by Nurse Ryan" width="120" style="max-width:120px;height:auto"/></div><div style="border:1px solid #e7e2db;border-radius:14px;overflow:hidden"><div style="background:#2F4349;padding:18px 22px;color:#ffffff;font-size:17px;font-weight:bold">Your deposit link</div><div style="padding:22px"><p style="margin:0 0 14px">Hi %s,</p><p style="margin:0 0 14px">Thanks for booking <strong>%s</strong> on <strong>%s</strong>.</p><p style="margin:0 0 18px">To secure your appointment please pay your deposit of <strong>&pound;25.38</strong> using the secure link below. It comes off your balance on the day.</p><p style="margin:0 0 22px;text-align:center"><a href="%s" style="display:inline-block;background:#2F4349;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:bold">Pay &pound;25.38 deposit</a></p><p style="margin:0 0 6px;font-size:13px;color:#6b7280">If the button does not work, copy and paste this link:</p><p style="margin:0 0 18px;font-size:12px;word-break:break-all"><a href="%s" style="color:#2F4349">%s</a></p><p style="margin:0">Thanks,<br/>Aesthetics by Nurse Ryan</p></div></div><p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:18px">Sent securely via MODO Book</p></div></body></html>$h$, logo, r.first_name, r.treatment, r.when_txt, r.url, r.url, r.url);
  txt := format('Hi %s, thanks for booking %s on %s. Please pay your deposit of GBP 25.38 to secure your appointment: %s - Aesthetics by Nurse Ryan', r.first_name, r.treatment, r.when_txt, r.url);
  insert into public.email_send_log (message_id, template_name, recipient_email, status) values (mid, 'patient-message', r.email, 'pending');
  perform public.enqueue_email('transactional_emails', jsonb_build_object(
    'message_id', mid, 'to', r.email, 'from', '"MODO Book" <noreply@modobook.uk>',
    'sender_domain', 'notify.modobook.uk', 'subject', 'Your deposit link - Aesthetics by Nurse Ryan',
    'html', html, 'text', txt, 'purpose', 'transactional', 'label', 'patient-message',
    'idempotency_key', mid, 'unsubscribe_token', tok, 'queued_at', now()));
  tok := null;
end loop;
end $$;