-- Victory Liner Careers — second batch of 10 synthetic applicant accounts,
-- bringing the demo dataset from 10 to 20 (see seed_test_applicants.sql for
-- the first batch and the full reasoning comment). Same shape, same rules:
-- real Supabase Auth accounts with a random undisclosed password (nobody is
-- meant to log in as them), full standalone resumes, applications spread
-- across new job categories this time for variety, resume evaluations, and
-- decision log history. No video interview data, same reason as before — a
-- real clip can't be faked.
--
-- Safe to re-run: every insert is guarded by a `where not exists` check on
-- email, so running this twice won't create duplicates.

do $$
declare
  pw text := crypt('TestApplicant_' || gen_random_uuid()::text, gen_salt('bf'));
begin

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
  ('9c8181a6-3aae-4707-a2b5-232efba89c89'::uuid, 'rosemarie.dizon45@gmail.com', 'Rosemarie Dizon'),
  ('ea1155a2-7678-4161-a299-d068982bcc9e'::uuid, 'kevin.mendoza27@gmail.com', 'Kevin Mendoza'),
  ('0b39eafe-21ac-427c-9011-7370ac591ace'::uuid, 'edwin.castillo63@gmail.com', 'Edwin Castillo'),
  ('36156547-48ee-401f-9c32-6ab13e2428d1'::uuid, 'teresa.villareal38@gmail.com', 'Teresa Villareal'),
  ('09a2e69a-162a-4779-854b-d0e12a333d59'::uuid, 'benedict.lopez51@gmail.com', 'Benedict Lopez'),
  ('aa03f9f4-065c-40d2-860e-8dcf01a78564'::uuid, 'grace.fernandez14@gmail.com', 'Grace Fernandez'),
  ('0c376473-68a9-4c93-85ad-db107807c107'::uuid, 'arnel.santiago72@gmail.com', 'Arnel Santiago'),
  ('28c80b4f-a5a0-4c85-85a2-aa651bd3eccf'::uuid, 'veronica.ocampo59@gmail.com', 'Veronica Ocampo'),
  ('c2c9d2b9-38b0-4fe1-9640-329251805110'::uuid, 'michelle.torres26@gmail.com', 'Michelle Torres'),
  ('53a8c9cd-5669-4a74-bac3-2cfa27ac9b35'::uuid, 'henry.dizon83@gmail.com', 'Henry Dizon')
) as v(id, email, full_name)
where not exists (select 1 from auth.users u where u.email = v.email);

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), v.id::text, v.id,
       jsonb_build_object('sub', v.id::text, 'email', v.email, 'email_verified', true),
       'email', now(), now(), now()
from (values
  ('9c8181a6-3aae-4707-a2b5-232efba89c89'::uuid, 'rosemarie.dizon45@gmail.com'),
  ('ea1155a2-7678-4161-a299-d068982bcc9e'::uuid, 'kevin.mendoza27@gmail.com'),
  ('0b39eafe-21ac-427c-9011-7370ac591ace'::uuid, 'edwin.castillo63@gmail.com'),
  ('36156547-48ee-401f-9c32-6ab13e2428d1'::uuid, 'teresa.villareal38@gmail.com'),
  ('09a2e69a-162a-4779-854b-d0e12a333d59'::uuid, 'benedict.lopez51@gmail.com'),
  ('aa03f9f4-065c-40d2-860e-8dcf01a78564'::uuid, 'grace.fernandez14@gmail.com'),
  ('0c376473-68a9-4c93-85ad-db107807c107'::uuid, 'arnel.santiago72@gmail.com'),
  ('28c80b4f-a5a0-4c85-85a2-aa651bd3eccf'::uuid, 'veronica.ocampo59@gmail.com'),
  ('c2c9d2b9-38b0-4fe1-9640-329251805110'::uuid, 'michelle.torres26@gmail.com'),
  ('53a8c9cd-5669-4a74-bac3-2cfa27ac9b35'::uuid, 'henry.dizon83@gmail.com')
) as v(id, email)
where not exists (select 1 from auth.identities i where i.user_id = v.id);

end $$;

-- ---------------------------------------------------------------------------
-- applicant_resumes
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
       v.has_nbi, v.shifting, v.medical_cert, now() - (v.days_ago || ' days')::interval, 5, false
from (values
  ('9c8181a6-3aae-4707-a2b5-232efba89c89'::uuid, 'Rosemarie Dizon', 'rosemarie.dizon45@gmail.com', '0917 456 7890', 'Cubao, Quezon City', 30,
   '[{"position":"Dispatch Coordinator","company":"FastCargo Logistics","startDate":"2021-04","endDate":"2025-06","description":"Coordinated delivery schedules and driver assignments, monitored real-time fleet status via tracking software, adjusted routes to minimize delays."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Business Administration","school":"Manila Central University","yearGraduated":"2020"}]'::jsonb,
   array['Scheduling Software','Logistics Coordination','Fleet Monitoring','Time Management','Problem Solving'],
   '[]'::jsonb,
   'Logistics coordinator with 4 years of experience managing delivery schedules and real-time fleet tracking.',
   null, array[]::text[], null, true, true, true, 7),

  ('ea1155a2-7678-4161-a299-d068982bcc9e'::uuid, 'Kevin Mendoza', 'kevin.mendoza27@gmail.com', '0928 567 8901', 'Quezon City', 24,
   '[{"position":"Social Media Coordinator","company":"Freelance","startDate":"2023-01","endDate":"2025-05","description":"Created social media content for small business clients, coordinated promotional posts and small local events."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Communication","school":"Far Eastern University","yearGraduated":"2023"}]'::jsonb,
   array['Social Media Content Creation','Graphic Design Basics','Event Coordination','Copywriting','Canva'],
   '[]'::jsonb,
   'Creative communications graduate with 2 years of freelance social media and small-event coordination experience.',
   null, array[]::text[], null, true, false, true, 6),

  ('0b39eafe-21ac-427c-9011-7370ac591ace'::uuid, 'Edwin Castillo', 'edwin.castillo63@gmail.com', '0933 678 9012', 'Caloocan City', 33,
   '[{"position":"Diesel Mechanic","company":"Dagupan Trucking Services","startDate":"2017-06","endDate":"2025-04","description":"Diagnosed and repaired diesel engines for a fleet of delivery trucks, performed scheduled preventive maintenance."}]'::jsonb,
   'Vocational Graduate',
   '[{"degree":"Vocational Diploma in Automotive/Diesel Mechanics","school":"Caloocan TESDA Training Center","yearGraduated":"2016"}]'::jsonb,
   array['Diesel Engine Repair','Preventive Maintenance','Engine Diagnostics','Hand & Power Tools','Troubleshooting'],
   '[{"title":"TESDA NC II Automotive Servicing","issuer":"TESDA","year":"2017"}]'::jsonb,
   'Diesel mechanic with 8 years of hands-on experience maintaining and repairing heavy diesel engines.',
   null, array[]::text[], null, true, true, true, 15),

  ('36156547-48ee-401f-9c32-6ab13e2428d1'::uuid, 'Teresa Villareal', 'teresa.villareal38@gmail.com', '0945 789 0123', 'Baguio City', 42,
   '[{"position":"Area Operations Supervisor","company":"2Go Travel","startDate":"2015-03","endDate":"2025-06","description":"Oversaw daily operations across 3 terminal branches, supervised terminal supervisors, managed performance targets and budget."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Business Management","school":"Saint Louis University Baguio","yearGraduated":"2013"}]'::jsonb,
   array['Multi-site Operations Management','Team Leadership','Budget Management','Performance KPI Tracking','Transportation Regulations'],
   '[]'::jsonb,
   'Operations leader with over 10 years managing multi-branch terminal operations and supervisory teams.',
   null, array[]::text[], null, true, true, true, 20),

  ('09a2e69a-162a-4779-854b-d0e12a333d59'::uuid, 'Benedict Lopez', 'benedict.lopez51@gmail.com', '0956 890 1234', 'Cubao, Quezon City', 29,
   '[{"position":"Fleet Maintenance Inspector","company":"DLTB Co.","startDate":"2020-02","endDate":"2025-05","description":"Conducted routine vehicle safety inspections, documented LTFRB/LTO compliance findings, flagged units requiring repair."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Mechanical Engineering","school":"Mapua University","yearGraduated":"2019"}]'::jsonb,
   array['Vehicle Safety Inspection','LTFRB/LTO Regulations','Technical Documentation','Fleet Maintenance','Root Cause Analysis'],
   '[]'::jsonb,
   'Mechanical engineer with 5 years of fleet safety inspection experience ensuring LTFRB/LTO compliance.',
   null, array[]::text[], null, true, true, true, 18),

  ('aa03f9f4-065c-40d2-860e-8dcf01a78564'::uuid, 'Grace Fernandez', 'grace.fernandez14@gmail.com', '0917 901 2345', 'Pasig City', 31,
   '[{"position":"Payroll Specialist","company":"Robinsons Retail Holdings","startDate":"2019-05","endDate":"2025-07","description":"Processed payroll for over 300 shift-based employees, handled SSS/PhilHealth/Pag-IBIG/BIR remittances, maintained strict confidentiality of employee records."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Accountancy","school":"Pamantasan ng Lungsod ng Pasig","yearGraduated":"2019"}]'::jsonb,
   array['Payroll Processing','Statutory Remittances','Confidentiality','Attention to Detail','Excel/Payroll Systems'],
   '[]'::jsonb,
   'Payroll specialist with 6 years of experience processing payroll and statutory remittances for large shift-based teams.',
   null, array[]::text[], null, true, false, true, 9),

  ('0c376473-68a9-4c93-85ad-db107807c107'::uuid, 'Arnel Santiago', 'arnel.santiago72@gmail.com', '0928 012 3456', 'Caloocan City', 36,
   '[{"position":"City Bus Driver","company":"Metro Transit Corp.","startDate":"2016-01","endDate":"2025-06","description":"Operated city buses on high-frequency metro routes, navigated heavy urban traffic while maintaining schedule adherence and passenger comfort."}]'::jsonb,
   'High School Graduate',
   '[{"degree":"High School Diploma","school":"Caloocan City National High School","yearGraduated":"2008"}]'::jsonb,
   array['Professional Driving','Urban Traffic Navigation','Customer Courtesy','Route Familiarity','Defensive Driving'],
   '[]'::jsonb,
   'City bus driver with 9 years of experience navigating high-frequency urban routes with a clean safety record.',
   'Professional', array['2','3'], 9, true, true, true, 22),

  ('28c80b4f-a5a0-4c85-85a2-aa651bd3eccf'::uuid, 'Veronica Ocampo', 'veronica.ocampo59@gmail.com', '0939 123 4567', 'Cubao, Quezon City', 35,
   '[{"position":"Head Cashier","company":"Puregold Price Club","startDate":"2017-03","endDate":"2025-06","description":"Supervised a team of 5 cashiers, reconciled daily collections across shifts, managed the store''s cash vault with zero discrepancies."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Business Administration major in Financial Management","school":"Technological University of the Philippines","yearGraduated":"2016"}]'::jsonb,
   array['Cash Vault Management','Reconciliation','Team Supervision','Financial Reporting','Integrity & Accuracy'],
   '[]'::jsonb,
   'Head cashier with 8 years of cash vault custody and team supervision experience with a zero-discrepancy track record.',
   null, array[]::text[], null, true, true, true, 21),

  ('c2c9d2b9-38b0-4fe1-9640-329251805110'::uuid, 'Michelle Torres', 'michelle.torres26@gmail.com', '0917 234 5670', 'Quezon City', 25,
   '[{"position":"Front Desk Associate","company":"Red Planet Hotel","startDate":"2023-02","endDate":"2025-05","description":"Assisted guests with check-in/check-out, addressed basic complaints, coordinated with housekeeping for service recovery."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Hospitality Management","school":"Quezon City University","yearGraduated":"2022"}]'::jsonb,
   array['Guest Relations','Basic Complaint Handling','Communication','Coordination'],
   '[]'::jsonb,
   'Hospitality graduate with 2 years of front-desk guest relations experience.',
   null, array[]::text[], null, true, true, true, 5),

  ('53a8c9cd-5669-4a74-bac3-2cfa27ac9b35'::uuid, 'Henry Dizon', 'henry.dizon83@gmail.com', '0928 345 6781', 'Pasig City', 27,
   '[{"position":"HR Staff (Recruitment Support)","company":"Manpower Staffing Agency","startDate":"2022-06","endDate":"2024-12","description":"Assisted senior recruiters with candidate sourcing and resume screening for various clients."}]'::jsonb,
   'College Graduate',
   '[{"degree":"Bachelor of Science in Psychology","school":"Rizal Technological University","yearGraduated":"2021"}]'::jsonb,
   array['Candidate Sourcing','Resume Screening','Applicant Tracking','Communication'],
   '[]'::jsonb,
   'HR support professional with 2 years of assisting end-to-end recruitment for staffing agency clients.',
   null, array[]::text[], null, true, false, true, 4)
) as v(applicant_id, full_name, email, phone, current_location, age, work_experience, education_level, education, skills, certifications, summary, license_type, license_restrictions, years_driving, has_nbi, shifting, medical_cert, days_ago)
where not exists (select 1 from public.applicant_resumes r where r.applicant_id = v.applicant_id);

-- ---------------------------------------------------------------------------
-- applications
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
  -- 68% resume score clears the 50% apply threshold, so quick-apply would
  -- have auto-advanced this straight to interview_stage in the real app,
  -- not left it at 'submitted' (see the same note in seed_test_applicants.sql).
  ('Trip Dispatcher', '9c8181a6-3aae-4707-a2b5-232efba89c89'::uuid, 'Rosemarie Dizon', 'rosemarie.dizon45@gmail.com', '0917 456 7890', 'interview_stage', 7,
   '[{"position":"Dispatch Coordinator","company":"FastCargo Logistics","startDate":"2021-04","endDate":"2025-06","description":"Coordinated delivery schedules and driver assignments, monitored real-time fleet status via tracking software, adjusted routes to minimize delays."}]'::jsonb,
   '[{"degree":"Bachelor of Science in Business Administration","school":"Manila Central University","yearGraduated":"2020"}]'::jsonb,
   array['Scheduling Software','Logistics Coordination','Fleet Monitoring','Time Management','Problem Solving'], '[]'::jsonb,
   'College Graduate', 'Cubao, Quezon City', null, array[]::text[], null, true, true, true, null::timestamptz, null::text),

  -- Same reasoning — 60% clears the threshold.
  ('Marketing Associate', 'ea1155a2-7678-4161-a299-d068982bcc9e'::uuid, 'Kevin Mendoza', 'kevin.mendoza27@gmail.com', '0928 567 8901', 'interview_stage', 6,
   '[{"position":"Social Media Coordinator","company":"Freelance","startDate":"2023-01","endDate":"2025-05","description":"Created social media content for small business clients, coordinated promotional posts and small local events."}]'::jsonb,
   '[{"degree":"Bachelor of Science in Communication","school":"Far Eastern University","yearGraduated":"2023"}]'::jsonb,
   array['Social Media Content Creation','Graphic Design Basics','Event Coordination','Copywriting','Canva'], '[]'::jsonb,
   'College Graduate', 'Quezon City', null, array[]::text[], null, true, false, true, null::timestamptz, null::text),

  -- Same reasoning — 80% clears the threshold.
  ('Diesel Engine Mechanic', '0b39eafe-21ac-427c-9011-7370ac591ace'::uuid, 'Edwin Castillo', 'edwin.castillo63@gmail.com', '0933 678 9012', 'interview_stage', 15,
   '[{"position":"Diesel Mechanic","company":"Dagupan Trucking Services","startDate":"2017-06","endDate":"2025-04","description":"Diagnosed and repaired diesel engines for a fleet of delivery trucks, performed scheduled preventive maintenance."}]'::jsonb,
   '[{"degree":"Vocational Diploma in Automotive/Diesel Mechanics","school":"Caloocan TESDA Training Center","yearGraduated":"2016"}]'::jsonb,
   array['Diesel Engine Repair','Preventive Maintenance','Engine Diagnostics','Hand & Power Tools','Troubleshooting'], '[{"title":"TESDA NC II Automotive Servicing","issuer":"TESDA","year":"2017"}]'::jsonb,
   'Vocational Graduate', 'Caloocan City', null, array[]::text[], null, true, true, true, null::timestamptz, null::text),

  ('Regional Operations Manager', '36156547-48ee-401f-9c32-6ab13e2428d1'::uuid, 'Teresa Villareal', 'teresa.villareal38@gmail.com', '0945 789 0123', 'interview_stage', 20,
   '[{"position":"Area Operations Supervisor","company":"2Go Travel","startDate":"2015-03","endDate":"2025-06","description":"Oversaw daily operations across 3 terminal branches, supervised terminal supervisors, managed performance targets and budget."}]'::jsonb,
   '[{"degree":"Bachelor of Science in Business Management","school":"Saint Louis University Baguio","yearGraduated":"2013"}]'::jsonb,
   array['Multi-site Operations Management','Team Leadership','Budget Management','Performance KPI Tracking','Transportation Regulations'], '[]'::jsonb,
   'College Graduate', 'Baguio City', null, array[]::text[], null, true, true, true, null::timestamptz, null::text),

  ('Vehicle Safety Inspector', '09a2e69a-162a-4779-854b-d0e12a333d59'::uuid, 'Benedict Lopez', 'benedict.lopez51@gmail.com', '0956 890 1234', 'interview_stage', 18,
   '[{"position":"Fleet Maintenance Inspector","company":"DLTB Co.","startDate":"2020-02","endDate":"2025-05","description":"Conducted routine vehicle safety inspections, documented LTFRB/LTO compliance findings, flagged units requiring repair."}]'::jsonb,
   '[{"degree":"Bachelor of Science in Mechanical Engineering","school":"Mapua University","yearGraduated":"2019"}]'::jsonb,
   array['Vehicle Safety Inspection','LTFRB/LTO Regulations','Technical Documentation','Fleet Maintenance','Root Cause Analysis'], '[]'::jsonb,
   'College Graduate', 'Cubao, Quezon City', null, array[]::text[], null, true, true, true, null::timestamptz, null::text),

  ('Payroll Officer', 'aa03f9f4-065c-40d2-860e-8dcf01a78564'::uuid, 'Grace Fernandez', 'grace.fernandez14@gmail.com', '0917 901 2345', 'interview_stage', 9,
   '[{"position":"Payroll Specialist","company":"Robinsons Retail Holdings","startDate":"2019-05","endDate":"2025-07","description":"Processed payroll for over 300 shift-based employees, handled SSS/PhilHealth/Pag-IBIG/BIR remittances, maintained strict confidentiality of employee records."}]'::jsonb,
   '[{"degree":"Bachelor of Science in Accountancy","school":"Pamantasan ng Lungsod ng Pasig","yearGraduated":"2019"}]'::jsonb,
   array['Payroll Processing','Statutory Remittances','Confidentiality','Attention to Detail','Excel/Payroll Systems'], '[]'::jsonb,
   'College Graduate', 'Pasig City', null, array[]::text[], null, true, false, true, null::timestamptz, null::text),

  ('City Route Bus Driver', '0c376473-68a9-4c93-85ad-db107807c107'::uuid, 'Arnel Santiago', 'arnel.santiago72@gmail.com', '0928 012 3456', 'advanced', 22,
   '[{"position":"City Bus Driver","company":"Metro Transit Corp.","startDate":"2016-01","endDate":"2025-06","description":"Operated city buses on high-frequency metro routes, navigated heavy urban traffic while maintaining schedule adherence and passenger comfort."}]'::jsonb,
   '[{"degree":"High School Diploma","school":"Caloocan City National High School","yearGraduated":"2008"}]'::jsonb,
   array['Professional Driving','Urban Traffic Navigation','Customer Courtesy','Route Familiarity','Defensive Driving'], '[]'::jsonb,
   'High School Graduate', 'Caloocan City', 'Professional', array['2','3'], 9, true, true, true, (current_date + 4)::timestamptz + interval '7 hours', 'Caloocan'),

  ('Senior Cashier / Cash Custodian', '28c80b4f-a5a0-4c85-85a2-aa651bd3eccf'::uuid, 'Veronica Ocampo', 'veronica.ocampo59@gmail.com', '0939 123 4567', 'advanced', 21,
   '[{"position":"Head Cashier","company":"Puregold Price Club","startDate":"2017-03","endDate":"2025-06","description":"Supervised a team of 5 cashiers, reconciled daily collections across shifts, managed the store''s cash vault with zero discrepancies."}]'::jsonb,
   '[{"degree":"Bachelor of Science in Business Administration major in Financial Management","school":"Technological University of the Philippines","yearGraduated":"2016"}]'::jsonb,
   array['Cash Vault Management','Reconciliation','Team Supervision','Financial Reporting','Integrity & Accuracy'], '[]'::jsonb,
   'College Graduate', 'Cubao, Quezon City', null, array[]::text[], null, true, true, true, (current_date + 6)::timestamptz + interval '10 hours', 'Cubao'),

  ('Customer Relations Officer', 'c2c9d2b9-38b0-4fe1-9640-329251805110'::uuid, 'Michelle Torres', 'michelle.torres26@gmail.com', '0917 234 5670', 'declined', 5,
   '[{"position":"Front Desk Associate","company":"Red Planet Hotel","startDate":"2023-02","endDate":"2025-05","description":"Assisted guests with check-in/check-out, addressed basic complaints, coordinated with housekeeping for service recovery."}]'::jsonb,
   '[{"degree":"Bachelor of Science in Hospitality Management","school":"Quezon City University","yearGraduated":"2022"}]'::jsonb,
   array['Guest Relations','Basic Complaint Handling','Communication','Coordination'], '[]'::jsonb,
   'College Graduate', 'Quezon City', null, array[]::text[], null, true, true, true, null::timestamptz, null::text),

  ('Recruitment Officer', '53a8c9cd-5669-4a74-bac3-2cfa27ac9b35'::uuid, 'Henry Dizon', 'henry.dizon83@gmail.com', '0928 345 6781', 'declined', 4,
   '[{"position":"HR Staff (Recruitment Support)","company":"Manpower Staffing Agency","startDate":"2022-06","endDate":"2024-12","description":"Assisted senior recruiters with candidate sourcing and resume screening for various clients."}]'::jsonb,
   '[{"degree":"Bachelor of Science in Psychology","school":"Rizal Technological University","yearGraduated":"2021"}]'::jsonb,
   array['Candidate Sourcing','Resume Screening','Applicant Tracking','Communication'], '[]'::jsonb,
   'College Graduate', 'Pasig City', null, array[]::text[], null, true, false, true, null::timestamptz, null::text)
) as v(job_title, applicant_id, full_name, email, phone, status, days_ago, work_experience, education, skills, certifications, education_level, current_location, license_type, license_restrictions, years_driving, has_nbi, shifting, medical_cert, scheduled_at, scheduled_location)
join public.job_postings j on j.title = v.job_title
where not exists (select 1 from public.applications a where a.applicant_id = v.applicant_id);

-- ---------------------------------------------------------------------------
-- resume_evaluations
-- ---------------------------------------------------------------------------
insert into public.resume_evaluations (application_id, job_id, score, explanation, criteria_assessment, model, evaluated_at)
select a.id, a.job_id, v.score, v.explanation, v.criteria_assessment, 'gemini-3.6-flash', a.created_at + interval '4 minutes'
from (values
  ('rosemarie.dizon45@gmail.com', 68, 'Genuine scheduling/dispatch background with real-time fleet monitoring experience, though exposure to dedicated transit dispatch software specifically is unconfirmed.',
   '[{"keyword":"Scheduling software experience","weight":4,"matched":true,"reasoning":"Used tracking/scheduling software to coordinate delivery schedules."},{"keyword":"Logistics coordination experience","weight":4,"matched":true,"reasoning":"Four years coordinating driver assignments and delivery routes."},{"keyword":"Real-time decision-making under time pressure","weight":3,"matched":true,"reasoning":"Adjusted routes in real time to minimize delays."}]'::jsonb),

  ('kevin.mendoza27@gmail.com', 60, 'Communication degree and genuine content-creation experience, but event/promotions work so far has been small-scale freelance rather than organizational campaigns.',
   '[{"keyword":"Social media content creation","weight":4,"matched":true,"reasoning":"Two years creating social media content for small business clients."},{"keyword":"Marketing/Communications degree","weight":3,"matched":true,"reasoning":"Bachelor of Science in Communication."},{"keyword":"Event/promotions coordination experience","weight":3,"matched":false,"reasoning":"Only small local events coordinated as a freelancer, not organizational campaigns."}]'::jsonb),

  ('edwin.castillo63@gmail.com', 80, 'Strong fit: years of direct diesel engine repair experience, a relevant TESDA certification, and clear preventive maintenance exposure.',
   '[{"keyword":"Diesel engine repair experience","weight":5,"matched":true,"reasoning":"Eight years diagnosing and repairing diesel engines for a trucking fleet."},{"keyword":"TESDA NC II certification","weight":4,"matched":true,"reasoning":"Holds TESDA NC II Automotive Servicing."},{"keyword":"Preventive maintenance scheduling knowledge","weight":3,"matched":true,"reasoning":"Performed scheduled preventive maintenance as part of regular duties."}]'::jsonb),

  ('teresa.villareal38@gmail.com', 82, 'Strong multi-site operations background with real supervisory and budget experience; strategic KPI-setting is implied but not explicitly detailed.',
   '[{"keyword":"Multi-site operations management experience","weight":5,"matched":true,"reasoning":"Ten years overseeing operations across three terminal branches."},{"keyword":"Strategic planning/KPI-setting experience","weight":5,"matched":false,"reasoning":"Managed performance targets, but no explicit strategic planning process described."},{"keyword":"Leadership of supervisory staff","weight":4,"matched":true,"reasoning":"Directly supervised terminal supervisors."},{"keyword":"Transportation regulation knowledge","weight":4,"matched":true,"reasoning":"Operations role within a transportation company implies regulatory familiarity."}]'::jsonb),

  ('benedict.lopez51@gmail.com', 86, 'Excellent fit: engineering degree plus direct, hands-on LTFRB/LTO compliance inspection experience in the bus industry.',
   '[{"keyword":"LTFRB/LTO regulation knowledge","weight":5,"matched":true,"reasoning":"Documented LTFRB/LTO compliance findings as part of daily duties."},{"keyword":"Engineering degree","weight":4,"matched":true,"reasoning":"Bachelor of Science in Mechanical Engineering."},{"keyword":"Vehicle inspection/roadworthiness assessment experience","weight":4,"matched":true,"reasoning":"Five years conducting routine vehicle safety inspections for a bus company."}]'::jsonb),

  ('grace.fernandez14@gmail.com', 89, 'Excellent fit: direct payroll processing for a large shift-based workforce with explicit statutory remittance experience.',
   '[{"keyword":"Payroll processing experience","weight":5,"matched":true,"reasoning":"Six years processing payroll for 300+ shift-based employees."},{"keyword":"SSS/PhilHealth/Pag-IBIG/BIR remittance knowledge","weight":5,"matched":true,"reasoning":"Directly handled all four statutory remittance types."},{"keyword":"Attention to detail with numbers","weight":4,"matched":true,"reasoning":"Large-scale payroll processing with no stated discrepancies."},{"keyword":"Confidentiality with employee data","weight":3,"matched":true,"reasoning":"Explicitly maintained strict confidentiality of employee records."}]'::jsonb),

  ('arnel.santiago72@gmail.com', 88, 'Excellent fit: nine years of city-route driving with exactly the urban traffic and passenger-comfort experience this role asks for.',
   '[{"keyword":"Professional driver''s license","weight":5,"matched":true,"reasoning":"Holds a Professional license with restriction codes 2/3."},{"keyword":"Heavy urban traffic driving experience","weight":4,"matched":true,"reasoning":"Nine years operating buses on high-frequency metro routes."},{"keyword":"Safe driving record","weight":5,"matched":true,"reasoning":"No incidents noted across nine years of city driving."},{"keyword":"Customer courtesy","weight":3,"matched":true,"reasoning":"Maintained passenger comfort as part of daily route operations."}]'::jsonb),

  ('veronica.ocampo59@gmail.com', 91, 'Excellent fit: direct cash vault custody, team supervision, and a flawless reconciliation track record.',
   '[{"keyword":"Cash handling and vault custody experience","weight":5,"matched":true,"reasoning":"Eight years managing a retail store''s cash vault."},{"keyword":"Reconciliation/auditing accuracy","weight":5,"matched":true,"reasoning":"Reconciled daily collections across shifts with zero discrepancies."},{"keyword":"Supervisory experience over cashiering staff","weight":3,"matched":true,"reasoning":"Supervised a team of five cashiers."},{"keyword":"High integrity, no derogatory financial records","weight":4,"matched":true,"reasoning":"Zero-discrepancy track record cited directly on the resume."}]'::jsonb),

  ('michelle.torres26@gmail.com', 52, 'Has genuine guest-facing communication experience, but the complaint handling shown is basic front-desk level, not the escalated service-recovery work this role requires.',
   '[{"keyword":"Complaint handling/service recovery experience","weight":5,"matched":false,"reasoning":"Only basic front-desk complaints handled, not escalated service recovery."},{"keyword":"Written and verbal communication","weight":4,"matched":true,"reasoning":"Two years of direct guest communication in a hotel front-desk role."},{"keyword":"Composure in difficult conversations","weight":4,"matched":false,"reasoning":"No evidence of handling difficult or high-stakes conversations."},{"keyword":"Refund/rebooking policy familiarity","weight":3,"matched":false,"reasoning":"No transport refund or rebooking policy experience on the resume."}]'::jsonb),

  ('henry.dizon83@gmail.com', 51, 'Has real recruitment support experience, but only at an assistant level under senior recruiters, not the end-to-end ownership this role calls for.',
   '[{"keyword":"End-to-end recruitment/sourcing experience","weight":5,"matched":false,"reasoning":"Assisted senior recruiters rather than owning the process end-to-end."},{"keyword":"Interviewing and candidate screening skills","weight":4,"matched":false,"reasoning":"Resume screening experience only, no interviewing responsibility described."},{"keyword":"Driver/frontline hiring requirements familiarity","weight":3,"matched":false,"reasoning":"Staffing agency clients were general, no stated driver/frontline-specific hiring experience."},{"keyword":"Organized applicant tracking/follow-through","weight":3,"matched":true,"reasoning":"Used applicant tracking as part of recruitment support duties."}]'::jsonb)
) as v(email, score, explanation, criteria_assessment)
join public.applications a on a.email = v.email
where not exists (select 1 from public.resume_evaluations re where re.application_id = a.id);

-- ---------------------------------------------------------------------------
-- application_decision_log
-- ---------------------------------------------------------------------------
insert into public.application_decision_log (application_id, decided_by, status, decided_at)
select a.id, 'fdd5f1b8-8ac0-47bb-a8a5-42bb6ed3ce87'::uuid, v.status, a.created_at + (v.after_days || ' days')::interval
from (values
  ('teresa.villareal38@gmail.com', 'interview_stage', 2),
  ('benedict.lopez51@gmail.com', 'interview_stage', 1),
  ('grace.fernandez14@gmail.com', 'interview_stage', 2),
  ('arnel.santiago72@gmail.com', 'interview_stage', 3),
  ('arnel.santiago72@gmail.com', 'advanced', 3),
  ('veronica.ocampo59@gmail.com', 'interview_stage', 2),
  ('veronica.ocampo59@gmail.com', 'advanced', 2),
  -- Declined only after completing the interview (see
  -- seed_test_interview_scores.sql) — the real app only lets a resume clear
  -- enough to apply in the first place (JobDetails.jsx's matchState.qualifies
  -- gate), so "declined straight out of resume screening, no interview"
  -- isn't a realistic outcome to demo.
  ('michelle.torres26@gmail.com', 'interview_stage', 1),
  ('michelle.torres26@gmail.com', 'declined', 3),
  ('henry.dizon83@gmail.com', 'interview_stage', 1),
  ('henry.dizon83@gmail.com', 'declined', 2)
) as v(email, status, after_days)
join public.applications a on a.email = v.email
where not exists (
  select 1 from public.application_decision_log d where d.application_id = a.id and d.status = v.status
);
