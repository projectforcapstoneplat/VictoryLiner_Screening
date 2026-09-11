-- Victory Liner Careers — 15 sample job postings, one per existing category
-- (see 0019_job_categories.sql), published immediately so they show up on
-- the live site right away. This is SAMPLE DATA, not a schema change — it
-- isn't part of the numbered migrations sequence and isn't meant to run
-- automatically; run it once in the Supabase SQL editor whenever you want a
-- realistic-looking set of postings to test/demo against. Deadlines are
-- relative to whenever you run this (30-90 days out), so they never go
-- stale sitting in this file. `created_by` is left null (no specific HR
-- account is assumed) — the app treats that as a normal, valid posting.
--
-- Safe to re-run without creating duplicates: each insert is guarded by a
-- `where not exists` check on the title.

insert into public.job_postings (title, category, location, employment_type, open_positions, description, required_qualifications, preferred_qualifications, status, application_deadline)
select * from (values
  ('Provincial Bus Driver', 'Bus Driver', 'Cubao', 'Full-time', 5,
   'Safely operate provincial route buses along assigned schedules, performing pre-trip and post-trip vehicle inspections and adhering strictly to traffic laws and company safety policies.',
   'Professional driver''s license with restriction codes 2/3, at least 3 years of driving experience, clean driving record, valid NBI clearance.',
   'Defensive driving certification, familiarity with NLEX/SLEX and major provincial routes.',
   'published', (current_date + 30)::date),

  ('Bus Conductor', 'Conductor', 'Caloocan', 'Full-time', 4,
   'Assist the driver on assigned trips — collect fares, issue tickets, ensure passenger safety and comfort, and help with boarding/alighting including passengers with special needs.',
   'High school diploma, strong communication skills, basic math for fare computation.',
   'Prior customer-facing or frontline service experience.',
   'published', (current_date + 32)::date),

  ('Diesel Engine Mechanic', 'Mechanic / Maintenance Technician', 'Caloocan', 'Full-time', 3,
   'Diagnose, repair, and maintain the fleet''s diesel engines and related systems to keep buses safe and roadworthy, including scheduled preventive maintenance.',
   'Vocational diploma in Automotive/Diesel Mechanics, at least 2 years of hands-on experience with heavy diesel engines.',
   'TESDA NC II certification, experience with Euro-standard bus engines.',
   'published', (current_date + 35)::date),

  ('Terminal Operations Assistant', 'Terminal Operations Staff', 'Cubao', 'Full-time', 3,
   'Support day-to-day terminal operations — coordinate bus arrivals/departures, assist passengers, maintain terminal cleanliness and order, and escalate issues to supervisors.',
   'High school diploma, willingness to work shifting schedules, physically fit for an active, on-your-feet role.',
   'Experience in a transport or logistics terminal environment.',
   'published', (current_date + 28)::date),

  ('Trip Dispatcher', 'Dispatcher / Trip Scheduler', 'Cubao', 'Full-time', 2,
   'Plan and coordinate trip schedules and driver/conductor assignments, monitor real-time fleet status, and adjust dispatch plans to minimize delays.',
   'Associate''s or Bachelor''s degree, strong organizational and multitasking skills, comfortable with scheduling software.',
   'Prior dispatch or logistics coordination experience in transportation.',
   'published', (current_date + 40)::date),

  ('Ticketing & Customer Service Representative', 'Customer Service / Ticketing', 'Cubao', 'Full-time', 4,
   'Assist passengers with ticket bookings, fare inquiries, and general concerns at the terminal counter and via phone/online channels, delivering a helpful and professional experience.',
   'High school diploma, excellent verbal communication skills, basic computer literacy.',
   'Prior experience in a customer service or front-desk role.',
   'published', (current_date + 33)::date),

  ('Terminal Cashier', 'Cashier / Teller', 'Baguio', 'Full-time', 2,
   'Handle cash and cashless ticket transactions accurately, reconcile daily collections, and maintain proper documentation of all terminal sales.',
   'High school diploma, strong integrity and attention to detail, basic cash-handling experience.',
   'Experience operating point-of-sale (POS) systems.',
   'published', (current_date + 30)::date),

  ('Accounting Staff', 'Accounting & Finance', 'Cubao', 'Full-time', 2,
   'Support day-to-day bookkeeping, accounts payable/receivable processing, and financial report preparation for the finance department.',
   'Bachelor''s degree in Accounting, Finance, or a related field, working knowledge of basic bookkeeping principles.',
   'CPA board exam passer or candidate, experience with QuickBooks or similar accounting software.',
   'published', (current_date + 45)::date),

  ('HR Generalist', 'Human Resources', 'Cubao', 'Full-time', 1,
   'Support recruitment, onboarding, employee relations, and compliance with Philippine labor law across the company''s workforce.',
   'Bachelor''s degree in Psychology, Human Resources Management, or a related field, working knowledge of PH labor law.',
   'Experience in recruitment and employee relations within an operations-heavy organization.',
   'published', (current_date + 50)::date),

  ('Administrative Assistant', 'Administrative / Clerical', 'Cubao', 'Contractual', 2,
   'Provide general administrative support — document filing and processing, correspondence, scheduling, and office supply coordination.',
   'High school diploma, proficient with MS Office (Word, Excel), organized and detail-oriented.',
   'Associate''s degree, prior office/clerical experience.',
   'published', (current_date + 25)::date),

  ('Terminal Security Guard', 'Security Guard', 'Caloocan', 'Full-time', 3,
   'Maintain the safety and security of terminal premises, passengers, and property — monitor entry/exit points, conduct inspections, and respond to incidents.',
   'Valid security guard license, high school diploma, good moral character with no derogatory records.',
   'Military or police background.',
   'published', (current_date + 38)::date),

  ('Vehicle Safety Inspector', 'Safety & Compliance Inspector', 'Cubao', 'Full-time', 2,
   'Conduct routine vehicle safety inspections, ensure fleet compliance with LTFRB/LTO regulations, and document and report safety findings.',
   'Bachelor''s degree in Engineering or a related field, working knowledge of LTFRB/LTO vehicle safety regulations.',
   'Experience in fleet safety compliance or vehicle inspection.',
   'published', (current_date + 42)::date),

  ('IT Support Specialist', 'Information Technology', 'Cubao', 'Full-time', 2,
   'Provide first-line technical support for hardware, software, and network issues across terminal and office locations, and maintain ticketing/point-of-sale systems.',
   'Bachelor''s degree in Information Technology, Computer Science, or a related field, strong troubleshooting skills.',
   'Experience supporting ticketing systems, networking certifications (e.g. CompTIA Network+).',
   'published', (current_date + 36)::date),

  ('Marketing Associate', 'Marketing & Sales', 'Cubao', 'Full-time', 1,
   'Support marketing campaigns, social media content, and promotional events to grow brand awareness and ridership.',
   'Bachelor''s degree in Marketing, Communications, or a related field, comfortable creating content for social media.',
   'Experience with brand promotions, events, or digital marketing campaigns.',
   'published', (current_date + 55)::date),

  ('Terminal Operations Supervisor', 'Operations Supervisor / Management', 'Baguio', 'Full-time', 1,
   'Oversee daily terminal operations, supervise frontline staff, and ensure schedules, safety standards, and customer service targets are consistently met.',
   'Bachelor''s degree, at least 3 years of supervisory experience in transportation, logistics, or a related operations-heavy field.',
   'Experience managing a team of 10 or more, familiarity with LTFRB regulations.',
   'published', (current_date + 48)::date)
) as v(title, category, location, employment_type, open_positions, description, required_qualifications, preferred_qualifications, status, application_deadline)
where not exists (select 1 from public.job_postings jp where jp.title = v.title);

-- A handful of weighted screening criteria per job (1 = nice to have, 5 =
-- critical) so the AI resume-matching stage has something real to score
-- against instead of falling back to "no specific criteria defined."
insert into public.criteria (job_id, keyword, weight)
select jp.id, c.keyword, c.weight
from (values
  ('Provincial Bus Driver', 'Professional driver''s license', 5),
  ('Provincial Bus Driver', 'Safe driving record', 5),
  ('Provincial Bus Driver', 'Defensive driving certification', 3),
  ('Bus Conductor', 'Customer service experience', 4),
  ('Bus Conductor', 'Fare handling / basic math', 4),
  ('Diesel Engine Mechanic', 'Diesel engine repair experience', 5),
  ('Diesel Engine Mechanic', 'TESDA NC II certification', 4),
  ('Terminal Operations Assistant', 'Willingness to work shifting schedule', 4),
  ('Terminal Operations Assistant', 'Terminal/logistics experience', 3),
  ('Trip Dispatcher', 'Scheduling software experience', 4),
  ('Trip Dispatcher', 'Logistics coordination experience', 4),
  ('Ticketing & Customer Service Representative', 'Customer service experience', 5),
  ('Ticketing & Customer Service Representative', 'Communication skills', 4),
  ('Terminal Cashier', 'Cash handling experience', 5),
  ('Terminal Cashier', 'POS system experience', 3),
  ('Accounting Staff', 'Accounting/Finance degree', 5),
  ('Accounting Staff', 'QuickBooks experience', 3),
  ('HR Generalist', 'PH labor law knowledge', 5),
  ('HR Generalist', 'Recruitment experience', 4),
  ('Administrative Assistant', 'MS Office proficiency', 4),
  ('Administrative Assistant', 'Office/clerical experience', 3),
  ('Terminal Security Guard', 'Valid security guard license', 5),
  ('Terminal Security Guard', 'Military/police background', 2),
  ('Vehicle Safety Inspector', 'LTFRB/LTO regulation knowledge', 5),
  ('Vehicle Safety Inspector', 'Engineering degree', 4),
  ('IT Support Specialist', 'Hardware/software troubleshooting', 5),
  ('IT Support Specialist', 'Networking certification', 3),
  ('Marketing Associate', 'Social media content creation', 4),
  ('Marketing Associate', 'Marketing/Communications degree', 3),
  ('Terminal Operations Supervisor', 'Supervisory experience', 5),
  ('Terminal Operations Supervisor', 'Team management (10+)', 4)
) as c(title, keyword, weight)
join public.job_postings jp on jp.title = c.title
where not exists (select 1 from public.criteria cr where cr.job_id = jp.id and cr.keyword = c.keyword);
