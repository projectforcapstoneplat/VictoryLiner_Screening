-- Victory Liner Careers — 10 synthetic applicant accounts + full standalone
-- resumes + applications spread across every real pipeline status
-- (submitted / interview_stage / advanced / declined), so Applicants,
-- Decisions, and the HR Head reports/charts look like a genuinely used
-- system instead of an empty shell. This is SAMPLE DATA, not a schema
-- change — not part of the numbered migrations, run it once whenever you
-- want this demo activity in place.
--
-- These accounts are real, working Supabase Auth users (same shape as a
-- normal email/password sign-up — auth.users + auth.identities, which fires
-- the existing handle_new_user trigger to create each profiles row) but use
-- a random, undisclosed password — nobody is meant to actually sign in as
-- them, they only need to exist and look real in HR's dashboards.
--
-- No video interview data is included — a real recorded clip can't be
-- faked, so the two "advanced" applicants are left at "scheduled, not yet
-- interviewed" rather than faking a completed video that would show a
-- broken "Watch Answer" link.
--
-- Safe to re-run: every insert is guarded by a `where not exists` check on
-- email, so running this twice won't create duplicates.

do $$
declare
  hr_id uuid := 'fdd5f1b8-8ac0-47bb-a8a5-42bb6ed3ce87'; -- John Peter, hr_personnel
  pw text := crypt('TestApplicant_' || gen_random_uuid()::text, gen_salt('bf'));
begin

-- ---------------------------------------------------------------------------
-- auth.users + auth.identities (triggers handle_new_user -> profiles)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  is_sso_user, is_anonymous
)
select '00000000-0000-0000-0000-000000000000', v.id, 'authenticated', 'authenticated', v.email, pw, now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('role', 'applicant', 'full_name', v.full_name),
       now(), now(), '', '', '', '', false, false
from (values
  ('0a2cdb03-37dd-4a6a-a249-3c0505d590b2'::uuid, 'maria.santos77@gmail.com', 'Maria Santos'),
  ('f1178e85-402a-47ac-a149-09fc989f87ee'::uuid, 'juan.delacruz84@gmail.com', 'Juan Dela Cruz'),
  ('f22b3fa5-b2a8-46a1-a33d-c6a2b547e57e'::uuid, 'angelo.reyes19@gmail.com', 'Angelo Reyes'),
  ('4dc12aad-0d9f-40e0-b40b-e4b2a5f47044'::uuid, 'catherine.bautista22@gmail.com', 'Catherine Bautista'),
  ('8f68f2b5-d993-4dfc-ab08-c36188fe964e'::uuid, 'mark.garcia55@gmail.com', 'Mark Anthony Garcia'),
  ('45a71784-e2a4-4dda-81a6-2866ac281bff'::uuid, 'joanna.villanueva33@gmail.com', 'Joanna Mae Villanueva'),
  ('f055bc36-558c-4970-8c3f-3bea60fb5a7f'::uuid, 'ricardo.fernandez41@gmail.com', 'Ricardo Fernandez'),
  ('ae144085-d4df-46c5-bfa0-83bb69ed853f'::uuid, 'patricia.ramos66@gmail.com', 'Patricia Ramos'),
  ('f5c0e51b-6f02-445f-8994-483d7b22a032'::uuid, 'noel.aquino12@gmail.com', 'Noel Aquino'),
  ('bd5dd813-3894-49e2-a664-a9eedaa4a106'::uuid, 'liza.torres88@gmail.com', 'Liza Torres')
) as v(id, email, full_name)
where not exists (select 1 from auth.users u where u.email = v.email);

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), v.id::text, v.id,
       jsonb_build_object('sub', v.id::text, 'email', v.email, 'email_verified', true),
       'email', now(), now(), now()
from (values
  ('0a2cdb03-37dd-4a6a-a249-3c0505d590b2'::uuid, 'maria.santos77@gmail.com'),
  ('f1178e85-402a-47ac-a149-09fc989f87ee'::uuid, 'juan.delacruz84@gmail.com'),
  ('f22b3fa5-b2a8-46a1-a33d-c6a2b547e57e'::uuid, 'angelo.reyes19@gmail.com'),
  ('4dc12aad-0d9f-40e0-b40b-e4b2a5f47044'::uuid, 'catherine.bautista22@gmail.com'),
  ('8f68f2b5-d993-4dfc-ab08-c36188fe964e'::uuid, 'mark.garcia55@gmail.com'),
  ('45a71784-e2a4-4dda-81a6-2866ac281bff'::uuid, 'joanna.villanueva33@gmail.com'),
  ('f055bc36-558c-4970-8c3f-3bea60fb5a7f'::uuid, 'ricardo.fernandez41@gmail.com'),
  ('ae144085-d4df-46c5-bfa0-83bb69ed853f'::uuid, 'patricia.ramos66@gmail.com'),
  ('f5c0e51b-6f02-445f-8994-483d7b22a032'::uuid, 'noel.aquino12@gmail.com'),
  ('bd5dd813-3894-49e2-a664-a9eedaa4a106'::uuid, 'liza.torres88@gmail.com')
) as v(id, email)
where not exists (select 1 from auth.identities i where i.user_id = v.id);

end $$;

-- ---------------------------------------------------------------------------
-- applicant_resumes — the standalone resume each account filled in
-- ---------------------------------------------------------------------------
insert into public.applicant_resumes (
  applicant_id, full_name, email, phone, current_location, age,
  work_experience, education_level, education, skills, certifications, summary,
  drivers_license_type, drivers_license_restrictions, years_driving_experience,
  has_nbi_clearance, willing_shifting_schedule, has_medical_certificate,
  completed_at, last_step, no_work_experience
)
select v.applicant_id, v.full_name, v.email, v.phone, v.current_location, v.age,
       v.work_experience, v.education_level, v.education, v.skills, v.certifications, v.summary,
       v.license_type, v.license_restrictions, v.years_driving,
       v.has_nbi, v.shifting, v.medical_cert, now() - (v.days_ago || ' days')::interval, 5, v.no_work_exp
from (values
  ('0a2cdb03-37dd-4a6a-a249-3c0505d590b2'::uuid, 'Maria Santos', 'maria.santos77@gmail.com', '0917 234 5678', 'Caloocan City', 24,
   '[{"position":"Cashier","company":"SM Supermarket","startDate":"2023-03","endDate":"2025-06","description":"Handled cash and card transactions, balanced daily cash drawer, assisted customers with inquiries and refunds."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Associate in Business Administration","school":"Caloocan City Polytechnic College","yearGraduated":"2022"}]'::jsonb,
   array['Cash Handling','POS Systems','Customer Service','Basic Bookkeeping','Attention to Detail'],
   '[]'::jsonb,
   'Detail-oriented cashier with 2+ years of experience in fast-paced retail environments, skilled in cash reconciliation and customer service.',
   null, array[]::text[], null, true, true, true, 16, false),

  ('f1178e85-402a-47ac-a149-09fc989f87ee'::uuid, 'Juan Dela Cruz', 'juan.delacruz84@gmail.com', '0928 456 7890', 'Cubao, Quezon City', 34,
   '[{"position":"Delivery Truck Driver","company":"JRS Express","startDate":"2019-01","endDate":"2025-05","description":"Operated delivery trucks on provincial routes, performed pre-trip inspections, maintained clean driving record."}]'::jsonb,
   'High School Graduate',
   '[{"degree":"High School Diploma","school":"Quezon City National High School","yearGraduated":"2010"}]'::jsonb,
   array['Professional Driving','Vehicle Inspection','Route Navigation','Defensive Driving','Safety Compliance'],
   '[{"title":"Professional Driver''s License (Code 2/3)","issuer":"LTO","year":"2018"}]'::jsonb,
   'Professional driver with 6 years of experience operating commercial vehicles on provincial routes, strong safety record.',
   'Professional', array['2','3'], 6, true, true, true, 14, false),

  ('f22b3fa5-b2a8-46a1-a33d-c6a2b547e57e'::uuid, 'Angelo Reyes', 'angelo.reyes19@gmail.com', '0933 123 4567', 'Quezon City', 26,
   '[{"position":"IT Support Assistant","company":"PLDT Home","startDate":"2022-06","endDate":"2025-07","description":"Provided first-line technical support for hardware/software/network issues, maintained ticketing system, resolved connectivity issues for clients."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Information Technology","school":"Polytechnic University of the Philippines","yearGraduated":"2022"}]'::jsonb,
   array['Hardware Troubleshooting','Network Administration','Ticketing Systems','Customer Support','Windows/Linux Administration'],
   '[{"title":"CompTIA Network+","issuer":"CompTIA","year":"2023"}]'::jsonb,
   'IT support specialist with 3 years of experience troubleshooting hardware, software, and network issues in a customer-facing environment.',
   null, array[]::text[], null, true, false, true, 12, false),

  ('4dc12aad-0d9f-40e0-b40b-e4b2a5f47044'::uuid, 'Catherine Bautista', 'catherine.bautista22@gmail.com', '0945 678 1234', 'Pasig City', 27,
   '[{"position":"Bookkeeper","company":"ABC Trading Corp.","startDate":"2021-02","endDate":"2025-08","description":"Managed accounts payable/receivable, prepared financial reports, reconciled bank statements monthly."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Accountancy","school":"University of Santo Tomas","yearGraduated":"2020"}]'::jsonb,
   array['Accounts Payable/Receivable','QuickBooks','Financial Reporting','Bank Reconciliation','Microsoft Excel'],
   '[{"title":"CPA Board Exam Candidate","issuer":"PRC","year":"2024"}]'::jsonb,
   'Detail-oriented accounting professional with 4 years of bookkeeping experience, proficient in QuickBooks and financial reporting.',
   null, array[]::text[], null, true, false, true, 11, false),

  ('8f68f2b5-d993-4dfc-ab08-c36188fe964e'::uuid, 'Mark Anthony Garcia', 'mark.garcia55@gmail.com', '0956 789 2345', 'Caloocan City', 29,
   '[{"position":"Jeepney Conductor/Barker","company":"Self-employed","startDate":"2020-01","endDate":"2025-04","description":"Collected fares, assisted passengers with boarding/alighting, handled cash accurately during peak hours."}]'::jsonb,
   'High School Graduate',
   '[{"degree":"High School Diploma","school":"Caloocan High School","yearGraduated":"2014"}]'::jsonb,
   array['Fare Collection','Customer Service','Cash Handling','Passenger Assistance','Conflict De-escalation'],
   '[]'::jsonb,
   'Experienced transport frontline worker with 5 years handling fare collection and passenger service in high-volume routes.',
   null, array[]::text[], null, true, true, true, 10, false),

  ('45a71784-e2a4-4dda-81a6-2866ac281bff'::uuid, 'Joanna Mae Villanueva', 'joanna.villanueva33@gmail.com', '0917 890 3456', 'Cubao, Quezon City', 23,
   '[{"position":"Customer Service Representative","company":"Teleperformance Philippines","startDate":"2022-09","endDate":"2025-06","description":"Handled inbound customer inquiries, resolved billing and service issues, maintained high customer satisfaction ratings."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Business Administration","school":"Far Eastern University","yearGraduated":"2022"}]'::jsonb,
   array['Customer Service','Communication Skills','Ticketing Systems','Problem Solving','Computer Literacy'],
   '[]'::jsonb,
   'Customer-focused professional with 3 years in call center and front-line service roles, strong communication and problem-solving skills.',
   null, array[]::text[], null, true, true, true, 9, false),

  ('f055bc36-558c-4970-8c3f-3bea60fb5a7f'::uuid, 'Ricardo Fernandez', 'ricardo.fernandez41@gmail.com', '0928 901 4567', 'Baguio City', 31,
   '[{"position":"Warehouse Operations Staff","company":"LBC Express","startDate":"2019-05","endDate":"2025-07","description":"Coordinated incoming/outgoing shipments, managed inventory, maintained safety and cleanliness of operations area."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Associate in Logistics Management","school":"Baguio College","yearGraduated":"2019"}]'::jsonb,
   array['Operations Coordination','Inventory Management','Team Coordination','Problem Solving','Shifting Schedule Flexibility'],
   '[]'::jsonb,
   'Operations professional with 6 years of experience in logistics coordination, physically fit and comfortable with shifting schedules.',
   null, array[]::text[], null, true, true, true, 19, false),

  ('ae144085-d4df-46c5-bfa0-83bb69ed853f'::uuid, 'Patricia Ramos', 'patricia.ramos66@gmail.com', '0939 012 5678', 'Cubao, Quezon City', 28,
   '[{"position":"HR Assistant","company":"Jollibee Foods Corporation","startDate":"2021-03","endDate":"2025-06","description":"Supported recruitment and onboarding processes, maintained employee records, assisted with labor law compliance documentation."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Psychology","school":"University of the Philippines Diliman","yearGraduated":"2021"}]'::jsonb,
   array['Recruitment','Employee Relations','PH Labor Law','Onboarding','HRIS Systems'],
   '[]'::jsonb,
   'HR professional with 4 years of experience in recruitment and employee relations within fast-paced operational organizations.',
   null, array[]::text[], null, true, false, true, 17, false),

  ('f5c0e51b-6f02-445f-8994-483d7b22a032'::uuid, 'Noel Aquino', 'noel.aquino12@gmail.com', '0945 123 6789', 'Caloocan City', 38,
   '[{"position":"Security Guard","company":"ABC Security Agency","startDate":"2020-01","endDate":"2024-12","description":"Monitored entry/exit points, conducted inspections, responded to incidents at commercial premises."}]'::jsonb,
   'High School Graduate',
   '[{"degree":"High School Diploma","school":"Caloocan National High School","yearGraduated":"2005"}]'::jsonb,
   array['Security Monitoring','Incident Response','Access Control'],
   '[{"title":"Security Guard License","issuer":"PNP-SOSIA","year":"2019"}]'::jsonb,
   'Security professional with experience monitoring commercial premises and responding to incidents.',
   null, array[]::text[], null, false, true, true, 13, false),

  ('bd5dd813-3894-49e2-a664-a9eedaa4a106'::uuid, 'Liza Torres', 'liza.torres88@gmail.com', '0917 345 6789', 'Pasig City', 22,
   '[]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Office Administration","school":"Rizal Technological University","yearGraduated":"2025"}]'::jsonb,
   array['MS Office','Organization','Communication'],
   '[]'::jsonb,
   'Recent graduate seeking an entry-level administrative role, eager to learn and grow.',
   null, array[]::text[], null, true, true, true, 8, true)
) as v(applicant_id, full_name, email, phone, current_location, age, work_experience, education_level, education, skills, certifications, summary, license_type, license_restrictions, years_driving, has_nbi, shifting, medical_cert, days_ago, no_work_exp)
where not exists (select 1 from public.applicant_resumes r where r.applicant_id = v.applicant_id);

-- ---------------------------------------------------------------------------
-- applications — one per applicant, status spread across the real pipeline
-- ---------------------------------------------------------------------------
insert into public.applications (
  job_id, applicant_id, full_name, email, phone, status, created_at,
  work_experience, education, skills, certifications, education_level, current_location,
  drivers_license_type, drivers_license_restrictions, years_driving_experience,
  has_nbi_clearance, willing_shifting_schedule, has_medical_certificate,
  interview_stage_at, scheduled_interview_at, scheduled_interview_location,
  scheduled_interview_set_by, scheduled_interview_set_at
)
select j.id, v.applicant_id, v.full_name, v.email, v.phone, v.status, now() - (v.days_ago || ' days')::interval,
       v.work_experience, v.education, v.skills, v.certifications, v.education_level, v.current_location,
       v.license_type, v.license_restrictions, v.years_driving,
       v.has_nbi, v.shifting, v.medical_cert,
       case when v.status in ('interview_stage','advanced','declined') then now() - ((v.days_ago - 2) || ' days')::interval else null end,
       v.scheduled_at,
       v.scheduled_location,
       case when v.scheduled_at is not null then 'fdd5f1b8-8ac0-47bb-a8a5-42bb6ed3ce87'::uuid else null end,
       case when v.scheduled_at is not null then now() - ((v.days_ago - 3) || ' days')::interval else null end
from (values
  ('Terminal Cashier', '0a2cdb03-37dd-4a6a-a249-3c0505d590b2'::uuid, 'Maria Santos', 'maria.santos77@gmail.com', '0917 234 5678', 'submitted', 16,
   '[{"position":"Cashier","company":"SM Supermarket","startDate":"2023-03","endDate":"2025-06","description":"Handled cash and card transactions, balanced daily cash drawer, assisted customers with inquiries and refunds."}]'::jsonb,
   '[{"degree":"Associate in Business Administration","school":"Caloocan City Polytechnic College","yearGraduated":"2022"}]'::jsonb,
   array['Cash Handling','POS Systems','Customer Service','Basic Bookkeeping','Attention to Detail'], '[]'::jsonb,
   'College Graduate', 'Caloocan City', null, array[]::text[], null, true, true, true, null::timestamptz, null::text),

  -- 65% resume score clears the 50% apply threshold, so in the real app
  -- quick-apply would have auto-advanced this straight to interview_stage
  -- (no HR action / decision_log entry involved) rather than leaving it at
  -- 'submitted' — matches what 'submitted' actually means once the apply
  -- flow is gated on already clearing the match threshold.
  ('Provincial Bus Driver', 'f1178e85-402a-47ac-a149-09fc989f87ee'::uuid, 'Juan Dela Cruz', 'juan.delacruz84@gmail.com', '0928 456 7890', 'interview_stage', 14,
   '[{"position":"Delivery Truck Driver","company":"JRS Express","startDate":"2019-01","endDate":"2025-05","description":"Operated delivery trucks on provincial routes, performed pre-trip inspections, maintained clean driving record."}]'::jsonb,
   '[{"degree":"High School Diploma","school":"Quezon City National High School","yearGraduated":"2010"}]'::jsonb,
   array['Professional Driving','Vehicle Inspection','Route Navigation','Defensive Driving','Safety Compliance'], '[{"title":"Professional Driver''s License (Code 2/3)","issuer":"LTO","year":"2018"}]'::jsonb,
   'High School Graduate', 'Cubao, Quezon City', 'Professional', array['2','3'], 6, true, true, true, null::timestamptz, null::text),

  -- Same reasoning — 72% clears the threshold.
  ('IT Support Specialist', 'f22b3fa5-b2a8-46a1-a33d-c6a2b547e57e'::uuid, 'Angelo Reyes', 'angelo.reyes19@gmail.com', '0933 123 4567', 'interview_stage', 12,
   '[{"position":"IT Support Assistant","company":"PLDT Home","startDate":"2022-06","endDate":"2025-07","description":"Provided first-line technical support for hardware/software/network issues, maintained ticketing system, resolved connectivity issues for clients."}]'::jsonb,
   '[{"degree":"Bachelor of Science in Information Technology","school":"Polytechnic University of the Philippines","yearGraduated":"2022"}]'::jsonb,
   array['Hardware Troubleshooting','Network Administration','Ticketing Systems','Customer Support','Windows/Linux Administration'], '[{"title":"CompTIA Network+","issuer":"CompTIA","year":"2023"}]'::jsonb,
   'College Graduate', 'Quezon City', null, array[]::text[], null, true, false, true, null::timestamptz, null::text),

  ('Accounting Staff', '4dc12aad-0d9f-40e0-b40b-e4b2a5f47044'::uuid, 'Catherine Bautista', 'catherine.bautista22@gmail.com', '0945 678 1234', 'interview_stage', 11,
   '[{"position":"Bookkeeper","company":"ABC Trading Corp.","startDate":"2021-02","endDate":"2025-08","description":"Managed accounts payable/receivable, prepared financial reports, reconciled bank statements monthly."}]'::jsonb,
   '[{"degree":"Bachelor of Science in Accountancy","school":"University of Santo Tomas","yearGraduated":"2020"}]'::jsonb,
   array['Accounts Payable/Receivable','QuickBooks','Financial Reporting','Bank Reconciliation','Microsoft Excel'], '[{"title":"CPA Board Exam Candidate","issuer":"PRC","year":"2024"}]'::jsonb,
   'College Graduate', 'Pasig City', null, array[]::text[], null, true, false, true, null::timestamptz, null::text),

  ('Bus Conductor', '8f68f2b5-d993-4dfc-ab08-c36188fe964e'::uuid, 'Mark Anthony Garcia', 'mark.garcia55@gmail.com', '0956 789 2345', 'interview_stage', 10,
   '[{"position":"Jeepney Conductor/Barker","company":"Self-employed","startDate":"2020-01","endDate":"2025-04","description":"Collected fares, assisted passengers with boarding/alighting, handled cash accurately during peak hours."}]'::jsonb,
   '[{"degree":"High School Diploma","school":"Caloocan High School","yearGraduated":"2014"}]'::jsonb,
   array['Fare Collection','Customer Service','Cash Handling','Passenger Assistance','Conflict De-escalation'], '[]'::jsonb,
   'High School Graduate', 'Caloocan City', null, array[]::text[], null, true, true, true, null::timestamptz, null::text),

  ('Ticketing & Customer Service Representative', '45a71784-e2a4-4dda-81a6-2866ac281bff'::uuid, 'Joanna Mae Villanueva', 'joanna.villanueva33@gmail.com', '0917 890 3456', 'interview_stage', 9,
   '[{"position":"Customer Service Representative","company":"Teleperformance Philippines","startDate":"2022-09","endDate":"2025-06","description":"Handled inbound customer inquiries, resolved billing and service issues, maintained high customer satisfaction ratings."}]'::jsonb,
   '[{"degree":"Bachelor of Science in Business Administration","school":"Far Eastern University","yearGraduated":"2022"}]'::jsonb,
   array['Customer Service','Communication Skills','Ticketing Systems','Problem Solving','Computer Literacy'], '[]'::jsonb,
   'College Graduate', 'Cubao, Quezon City', null, array[]::text[], null, true, true, true, null::timestamptz, null::text),

  ('Terminal Operations Assistant', 'f055bc36-558c-4970-8c3f-3bea60fb5a7f'::uuid, 'Ricardo Fernandez', 'ricardo.fernandez41@gmail.com', '0928 901 4567', 'advanced', 19,
   '[{"position":"Warehouse Operations Staff","company":"LBC Express","startDate":"2019-05","endDate":"2025-07","description":"Coordinated incoming/outgoing shipments, managed inventory, maintained safety and cleanliness of operations area."}]'::jsonb,
   '[{"degree":"Associate in Logistics Management","school":"Baguio College","yearGraduated":"2019"}]'::jsonb,
   array['Operations Coordination','Inventory Management','Team Coordination','Problem Solving','Shifting Schedule Flexibility'], '[]'::jsonb,
   'College Graduate', 'Baguio City', null, array[]::text[], null, true, true, true, (current_date + 5)::timestamptz + interval '7 hours', 'Baguio'),

  ('HR Generalist', 'ae144085-d4df-46c5-bfa0-83bb69ed853f'::uuid, 'Patricia Ramos', 'patricia.ramos66@gmail.com', '0939 012 5678', 'advanced', 17,
   '[{"position":"HR Assistant","company":"Jollibee Foods Corporation","startDate":"2021-03","endDate":"2025-06","description":"Supported recruitment and onboarding processes, maintained employee records, assisted with labor law compliance documentation."}]'::jsonb,
   '[{"degree":"Bachelor of Science in Psychology","school":"University of the Philippines Diliman","yearGraduated":"2021"}]'::jsonb,
   array['Recruitment','Employee Relations','PH Labor Law','Onboarding','HRIS Systems'], '[]'::jsonb,
   'College Graduate', 'Cubao, Quezon City', null, array[]::text[], null, true, false, true, (current_date + 3)::timestamptz + interval '10 hours', 'Cubao'),

  ('Terminal Security Guard', 'f5c0e51b-6f02-445f-8994-483d7b22a032'::uuid, 'Noel Aquino', 'noel.aquino12@gmail.com', '0945 123 6789', 'declined', 13,
   '[{"position":"Security Guard","company":"ABC Security Agency","startDate":"2020-01","endDate":"2024-12","description":"Monitored entry/exit points, conducted inspections, responded to incidents at commercial premises."}]'::jsonb,
   '[{"degree":"High School Diploma","school":"Caloocan National High School","yearGraduated":"2005"}]'::jsonb,
   array['Security Monitoring','Incident Response','Access Control'], '[{"title":"Security Guard License","issuer":"PNP-SOSIA","year":"2019"}]'::jsonb,
   'High School Graduate', 'Caloocan City', null, array[]::text[], null, false, true, true, null::timestamptz, null::text),

  ('Administrative Assistant', 'bd5dd813-3894-49e2-a664-a9eedaa4a106'::uuid, 'Liza Torres', 'liza.torres88@gmail.com', '0917 345 6789', 'declined', 8,
   '[]'::jsonb,
   '[{"degree":"Bachelor of Science in Office Administration","school":"Rizal Technological University","yearGraduated":"2025"}]'::jsonb,
   array['MS Office','Organization','Communication'], '[]'::jsonb,
   'College Graduate', 'Pasig City', null, array[]::text[], null, true, true, true, null::timestamptz, null::text)
) as v(job_title, applicant_id, full_name, email, phone, status, days_ago, work_experience, education, skills, certifications, education_level, current_location, license_type, license_restrictions, years_driving, has_nbi, shifting, medical_cert, scheduled_at, scheduled_location)
join public.job_postings j on j.title = v.job_title
where not exists (select 1 from public.applications a where a.applicant_id = v.applicant_id);

-- ---------------------------------------------------------------------------
-- resume_evaluations — the AI resume score HR sees per application
-- ---------------------------------------------------------------------------
insert into public.resume_evaluations (application_id, job_id, score, explanation, criteria_assessment, model, evaluated_at)
select a.id, a.job_id, v.score, v.explanation, v.criteria_assessment, 'gemini-3.6-flash', a.created_at + interval '4 minutes'
from (values
  ('maria.santos77@gmail.com', 78, 'Strong fit for a cashier role with direct retail cash-handling experience and attention to detail; lacks dedicated POS certification but shows clear accuracy under pressure.',
   '[{"keyword":"Cash handling experience","weight":5,"matched":true,"reasoning":"Two years as a supermarket cashier handling cash and card transactions."},{"keyword":"POS system experience","weight":3,"matched":false,"reasoning":"No POS system explicitly named in the resume."},{"keyword":"Accuracy under pressure","weight":4,"matched":true,"reasoning":"Balanced daily cash drawer accurately in a high-traffic supermarket."}]'::jsonb),

  ('juan.delacruz84@gmail.com', 65, 'Meets the core licensing and experience requirements for a provincial driving role, though the resume shows delivery-route rather than passenger-route driving experience.',
   '[{"keyword":"Professional driver''s license","weight":5,"matched":true,"reasoning":"Holds a Professional license with restriction codes 2/3."},{"keyword":"Safe driving record","weight":5,"matched":true,"reasoning":"Six years driving commercial delivery routes with no stated incidents."},{"keyword":"Defensive driving certification","weight":3,"matched":false,"reasoning":"No defensive driving certification listed."},{"keyword":"Vehicle inspection knowledge","weight":3,"matched":true,"reasoning":"Performed pre-trip inspections as part of delivery duties."}]'::jsonb),

  ('angelo.reyes19@gmail.com', 72, 'Solid technical troubleshooting background and a relevant IT degree; has a networking certification but limited exposure to ticketing/POS-specific systems.',
   '[{"keyword":"Hardware/software troubleshooting","weight":5,"matched":true,"reasoning":"Three years providing first-line technical support for hardware, software, and network issues."},{"keyword":"Networking certification","weight":3,"matched":true,"reasoning":"Holds CompTIA Network+."},{"keyword":"Ticketing/POS system support experience","weight":3,"matched":false,"reasoning":"Maintained a general IT ticketing system, not a POS-specific one."}]'::jsonb),

  ('catherine.bautista22@gmail.com', 88, 'Excellent fit: accounting degree, hands-on AP/AR experience, and QuickBooks proficiency directly match the role''s core requirements.',
   '[{"keyword":"Accounting/Finance degree","weight":5,"matched":true,"reasoning":"Bachelor of Science in Accountancy."},{"keyword":"QuickBooks experience","weight":3,"matched":true,"reasoning":"Used QuickBooks for bookkeeping at prior employer."},{"keyword":"Accounts payable/receivable processing experience","weight":4,"matched":true,"reasoning":"Four years managing AP/AR and reconciling bank statements."}]'::jsonb),

  ('mark.garcia55@gmail.com', 74, 'Strong real-world fare-handling and passenger-service background, though self-employed experience lacks a formal conflict de-escalation framework.',
   '[{"keyword":"Customer service experience","weight":4,"matched":true,"reasoning":"Five years assisting passengers with boarding and service during high-volume routes."},{"keyword":"Fare handling/basic math","weight":4,"matched":true,"reasoning":"Directly collected and handled fares accurately during peak hours."},{"keyword":"Conflict de-escalation/passenger handling","weight":3,"matched":false,"reasoning":"No formal conflict resolution training mentioned, though passenger assistance is listed."}]'::jsonb),

  ('joanna.villanueva33@gmail.com', 81, 'Strong communication and customer service track record from call center experience, directly transferable to a ticketing/front-desk role.',
   '[{"keyword":"Customer service experience","weight":5,"matched":true,"reasoning":"Three years handling inbound customer inquiries at a BPO."},{"keyword":"Communication skills","weight":4,"matched":true,"reasoning":"Resolved billing and service issues while maintaining high satisfaction ratings."},{"keyword":"Basic computer/ticketing system literacy","weight":3,"matched":true,"reasoning":"Used internal support/ticketing tools in a call center environment."}]'::jsonb),

  ('ricardo.fernandez41@gmail.com', 90, 'Excellent fit: years of hands-on logistics/operations coordination, explicit shifting-schedule willingness, and strong team coordination experience.',
   '[{"keyword":"Willingness to work shifting schedule","weight":4,"matched":true,"reasoning":"Explicitly willing to work a shifting schedule."},{"keyword":"Terminal/logistics experience","weight":3,"matched":true,"reasoning":"Six years coordinating shipments and inventory in a logistics warehouse."},{"keyword":"Composure under high passenger volume","weight":3,"matched":true,"reasoning":"Experience maintaining order and safety during high-volume warehouse operations, a close analogue."}]'::jsonb),

  ('patricia.ramos66@gmail.com', 85, 'Strong fit: psychology degree plus hands-on recruitment and onboarding experience at a large operations-heavy employer.',
   '[{"keyword":"PH labor law knowledge","weight":5,"matched":true,"reasoning":"Assisted with labor law compliance documentation at a prior employer."},{"keyword":"Recruitment experience","weight":4,"matched":true,"reasoning":"Four years supporting recruitment and onboarding processes."},{"keyword":"Employee relations/conflict handling experience","weight":3,"matched":true,"reasoning":"Maintained employee records and supported relations processes at Jollibee Foods Corporation."}]'::jsonb),

  ('noel.aquino12@gmail.com', 52, 'Has a valid security license and real guarding experience, but the application is missing a current NBI clearance, a hard requirement for this role.',
   '[{"keyword":"Valid security guard license","weight":5,"matched":true,"reasoning":"Holds a Security Guard License from PNP-SOSIA."},{"keyword":"Military/police background","weight":2,"matched":false,"reasoning":"No military or police background listed."},{"keyword":"Good moral character/no derogatory records","weight":4,"matched":false,"reasoning":"No NBI/police clearance on file, which this role treats as a baseline integrity check."}]'::jsonb),

  ('liza.torres88@gmail.com', 52, 'Relevant degree and basic office skills, but no prior work experience at all to demonstrate applied clerical/organizational ability.',
   '[{"keyword":"MS Office proficiency","weight":4,"matched":true,"reasoning":"Lists MS Office as a skill, consistent with the degree program."},{"keyword":"Office/clerical experience","weight":3,"matched":false,"reasoning":"No work experience listed — recent graduate with no clerical role history."},{"keyword":"Organizational and time-management skills","weight":3,"matched":false,"reasoning":"Self-reported only, with no work history to corroborate it."}]'::jsonb)
) as v(email, score, explanation, criteria_assessment)
join public.applications a on a.email = v.email
where not exists (select 1 from public.resume_evaluations re where re.application_id = a.id);

-- ---------------------------------------------------------------------------
-- application_decision_log — HR decision history behind each status
-- ---------------------------------------------------------------------------
insert into public.application_decision_log (application_id, decided_by, status, decided_at)
select a.id, 'fdd5f1b8-8ac0-47bb-a8a5-42bb6ed3ce87'::uuid, v.status, a.created_at + (v.after_days || ' days')::interval
from (values
  ('catherine.bautista22@gmail.com', 'interview_stage', 2),
  ('mark.garcia55@gmail.com', 'interview_stage', 1),
  ('joanna.villanueva33@gmail.com', 'interview_stage', 3),
  ('ricardo.fernandez41@gmail.com', 'interview_stage', 2),
  ('ricardo.fernandez41@gmail.com', 'advanced', 3),
  ('patricia.ramos66@gmail.com', 'interview_stage', 1),
  ('patricia.ramos66@gmail.com', 'advanced', 2),
  -- Declined only after completing the interview (see
  -- seed_test_interview_scores.sql) — the real app only lets a resume clear
  -- enough to apply in the first place (JobDetails.jsx's matchState.qualifies
  -- gate), so "declined straight out of resume screening, no interview"
  -- isn't a realistic outcome to demo.
  ('noel.aquino12@gmail.com', 'interview_stage', 1),
  ('noel.aquino12@gmail.com', 'declined', 3),
  ('liza.torres88@gmail.com', 'interview_stage', 1),
  ('liza.torres88@gmail.com', 'declined', 2)
) as v(email, status, after_days)
join public.applications a on a.email = v.email
where not exists (
  select 1 from public.application_decision_log d where d.application_id = a.id and d.status = v.status
);
