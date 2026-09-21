-- Victory Liner Careers — sample job postings across every category (see
-- 0019_job_categories.sql), 2-3 distinct real roles per category rather than
-- a single token one, published immediately so they show up on the live
-- site right away. This is SAMPLE DATA, not a schema change — it isn't part
-- of the numbered migrations sequence and isn't meant to run automatically;
-- run it once in the Supabase SQL editor whenever you want a realistic-
-- looking set of postings to test/demo against. Deadlines are relative to
-- whenever you run this, so they never go stale sitting in this file.
-- `created_by` is left null (no specific HR account is assumed) — the app
-- treats that as a normal, valid posting. location/employment_type use the
-- app's own fixed option lists (STATIONS/EMPLOYMENT_TYPES in
-- src/lib/jobConstants.js) — nothing here is a value the actual job posting
-- form couldn't have produced itself.
--
-- Safe to re-run without creating duplicates: each insert is guarded by a
-- `where not exists` check on the title.

insert into public.job_postings (title, category, location, employment_type, open_positions, description, required_qualifications, preferred_qualifications, status, application_deadline)
select * from (values
  -- Bus Driver
  ('Provincial Bus Driver', 'Bus Driver', 'Cubao', 'Full-time', 5,
   'Safely operate provincial route buses along assigned schedules, performing pre-trip and post-trip vehicle inspections and adhering strictly to traffic laws and company safety policies.',
   'Professional driver''s license with restriction codes 2/3, at least 3 years of driving experience, clean driving record, valid NBI clearance.',
   'Defensive driving certification, familiarity with NLEX/SLEX and major provincial routes.',
   'published', (current_date + 30)::date),
  ('City Route Bus Driver', 'Bus Driver', 'Caloocan', 'Full-time', 4,
   'Operate buses on shorter metro routes with frequent stops, navigating heavy urban traffic while maintaining schedule adherence and passenger safety and comfort.',
   'Professional driver''s license with restriction codes 2/3, at least 2 years of driving experience in urban/metro conditions, clean driving record.',
   'Experience with high-frequency stop-and-go routes, customer courtesy training.',
   'published', (current_date + 27)::date),
  ('Airport Express Bus Driver', 'Bus Driver', 'Baguio', 'Full-time', 3,
   'Operate non-stop, premium point-to-point express trips between terminals, upholding a higher standard of punctuality, vehicle presentation, and passenger service.',
   'Professional driver''s license with restriction codes 2/3, at least 4 years of driving experience, clean driving record, valid NBI clearance.',
   'Familiarity with expressway routes (NLEX/SLEX/TPLEX), prior premium/point-to-point service experience.',
   'published', (current_date + 34)::date),

  -- Conductor
  ('Bus Conductor', 'Conductor', 'Caloocan', 'Full-time', 4,
   'Assist the driver on assigned trips — collect fares, issue tickets, ensure passenger safety and comfort, and help with boarding/alighting including passengers with special needs.',
   'High school diploma, strong communication skills, basic math for fare computation.',
   'Prior customer-facing or frontline service experience.',
   'published', (current_date + 32)::date),
  ('Senior Bus Conductor (Team Lead)', 'Conductor', 'Cubao', 'Full-time', 2,
   'Oversee a small team of conductors on assigned routes — handle escalated passenger concerns, reconcile fare collections across the team, and mentor newly hired conductors.',
   'At least 2 years of experience as a bus conductor, strong fare-reconciliation accuracy, basic supervisory or mentoring experience.',
   'Conflict de-escalation training, familiarity with multiple route assignments.',
   'published', (current_date + 36)::date),

  -- Mechanic / Maintenance Technician
  ('Diesel Engine Mechanic', 'Mechanic / Maintenance Technician', 'Caloocan', 'Full-time', 3,
   'Diagnose, repair, and maintain the fleet''s diesel engines and related systems to keep buses safe and roadworthy, including scheduled preventive maintenance.',
   'Vocational diploma in Automotive/Diesel Mechanics, at least 2 years of hands-on experience with heavy diesel engines.',
   'TESDA NC II certification, experience with Euro-standard bus engines.',
   'published', (current_date + 35)::date),
  ('Auto Electrician', 'Mechanic / Maintenance Technician', 'Caloocan', 'Full-time', 2,
   'Diagnose and repair vehicle electrical systems — wiring, batteries, lighting, and onboard electronics — and respond to on-call breakdown calls when needed.',
   'Vocational diploma in Automotive Electrical or equivalent, at least 2 years of experience with vehicle electrical systems.',
   'TESDA Automotive Electrical NC II certification, willingness to be on-call for breakdown response.',
   'published', (current_date + 31)::date),
  ('Body & Chassis Technician', 'Mechanic / Maintenance Technician', 'Baguio', 'Full-time', 2,
   'Perform welding, metal fabrication, and structural repair on bus bodies and chassis following collision damage or routine wear, in line with structural safety standards.',
   'Vocational diploma in Automotive Body/Chassis Repair or equivalent, at least 2 years of welding/fabrication experience.',
   'TESDA NC II in Automotive Body/Chassis Repair, prior heavy-vehicle collision repair experience.',
   'published', (current_date + 38)::date),

  -- Terminal Operations Staff
  ('Terminal Operations Assistant', 'Terminal Operations Staff', 'Cubao', 'Full-time', 3,
   'Support day-to-day terminal operations — coordinate bus arrivals/departures, assist passengers, maintain terminal cleanliness and order, and escalate issues to supervisors.',
   'High school diploma, willingness to work shifting schedules, physically fit for an active, on-your-feet role.',
   'Experience in a transport or logistics terminal environment.',
   'published', (current_date + 28)::date),
  ('Terminal Operations Coordinator', 'Terminal Operations Staff', 'Baguio', 'Full-time', 2,
   'Coordinate across ticketing, dispatch, and frontline staff to keep terminal operations running smoothly, and resolve cross-department bottlenecks as they come up.',
   'Associate''s or Bachelor''s degree, at least 1 year of terminal or logistics operations experience, willingness to work shifting schedules.',
   'Experience coordinating across multiple departments or teams.',
   'published', (current_date + 41)::date),

  -- Dispatcher / Trip Scheduler
  ('Trip Dispatcher', 'Dispatcher / Trip Scheduler', 'Cubao', 'Full-time', 2,
   'Plan and coordinate trip schedules and driver/conductor assignments, monitor real-time fleet status, and adjust dispatch plans to minimize delays.',
   'Associate''s or Bachelor''s degree, strong organizational and multitasking skills, comfortable with scheduling software.',
   'Prior dispatch or logistics coordination experience in transportation.',
   'published', (current_date + 40)::date),
  ('Fleet Scheduling Officer', 'Dispatcher / Trip Scheduler', 'Cubao', 'Full-time', 1,
   'Plan longer-horizon driver and vehicle rosters, balancing service coverage against labor-law rest requirements and vehicle maintenance windows.',
   'Bachelor''s degree, at least 1 year of shift/roster planning experience, proficiency with scheduling or fleet management software.',
   'Working knowledge of DOLE rules on rest periods and duty hours.',
   'published', (current_date + 44)::date),

  -- Customer Service / Ticketing
  ('Ticketing & Customer Service Representative', 'Customer Service / Ticketing', 'Cubao', 'Full-time', 4,
   'Assist passengers with ticket bookings, fare inquiries, and general concerns at the terminal counter and via phone/online channels, delivering a helpful and professional experience.',
   'High school diploma, excellent verbal communication skills, basic computer literacy.',
   'Prior experience in a customer service or front-desk role.',
   'published', (current_date + 33)::date),
  ('Online Booking Support Agent', 'Customer Service / Ticketing', 'Cubao', 'Full-time', 2,
   'Handle passenger inquiries and issues for online/app bookings through chat and email, troubleshooting payment and reservation problems and coordinating fixes with IT when needed.',
   'High school diploma, strong written communication skills, comfortable with booking/payment systems.',
   'Prior chat or email-based customer support experience.',
   'published', (current_date + 29)::date),
  ('Customer Relations Officer', 'Customer Service / Ticketing', 'Baguio', 'Full-time', 1,
   'Handle escalated passenger complaints, coordinate refunds and rebooking, and drive service-recovery efforts to protect the company''s reputation with affected customers.',
   'Bachelor''s degree, at least 1 year of complaint-handling or customer relations experience, composed communication style under difficult conversations.',
   'Familiarity with refund/rebooking policy administration.',
   'published', (current_date + 37)::date),

  -- Cashier / Teller
  ('Terminal Cashier', 'Cashier / Teller', 'Baguio', 'Full-time', 2,
   'Handle cash and cashless ticket transactions accurately, reconcile daily collections, and maintain proper documentation of all terminal sales.',
   'High school diploma, strong integrity and attention to detail, basic cash-handling experience.',
   'Experience operating point-of-sale (POS) systems.',
   'published', (current_date + 30)::date),
  ('Senior Cashier / Cash Custodian', 'Cashier / Teller', 'Cubao', 'Full-time', 1,
   'Oversee the terminal''s cash vault, reconcile collections across multiple cashiers at shift close, and maintain accurate daily cash reports for finance.',
   'High school diploma, at least 2 years of cash-handling experience, strong reconciliation accuracy, clean financial background.',
   'Prior cash custodian or vault-management experience.',
   'published', (current_date + 43)::date),

  -- Accounting & Finance
  ('Accounting Staff', 'Accounting & Finance', 'Cubao', 'Full-time', 2,
   'Support day-to-day bookkeeping, accounts payable/receivable processing, and financial report preparation for the finance department.',
   'Bachelor''s degree in Accounting, Finance, or a related field, working knowledge of basic bookkeeping principles.',
   'CPA board exam passer or candidate, experience with QuickBooks or similar accounting software.',
   'published', (current_date + 45)::date),
  ('Payroll Officer', 'Accounting & Finance', 'Cubao', 'Full-time', 1,
   'Process payroll for drivers, conductors, and office staff, and handle statutory remittances (SSS, PhilHealth, Pag-IBIG, BIR) accurately and on time.',
   'Bachelor''s degree in Accounting, Finance, or a related field, at least 1 year of payroll processing experience, working knowledge of statutory remittance requirements.',
   'Experience running payroll for a large or shift-based workforce.',
   'published', (current_date + 39)::date),
  ('Internal Audit Assistant', 'Accounting & Finance', 'Cubao', 'Full-time', 1,
   'Review terminal cash and sales reports for discrepancies, assist in routine internal audits, and help document and escalate findings to management.',
   'Bachelor''s degree in Accounting, Finance, or a related field, strong analytical and detail-oriented mindset.',
   'Prior audit or bookkeeping-review experience.',
   'published', (current_date + 47)::date),

  -- Human Resources
  ('HR Generalist', 'Human Resources', 'Cubao', 'Full-time', 1,
   'Support recruitment, onboarding, employee relations, and compliance with Philippine labor law across the company''s workforce.',
   'Bachelor''s degree in Psychology, Human Resources Management, or a related field, working knowledge of PH labor law.',
   'Experience in recruitment and employee relations within an operations-heavy organization.',
   'published', (current_date + 50)::date),
  ('Recruitment Officer', 'Human Resources', 'Cubao', 'Full-time', 1,
   'Source, screen, and coordinate interviews for driving, frontline, and office roles, keeping the applicant pipeline organized and moving from posting to hire.',
   'Bachelor''s degree in Psychology, Human Resources Management, or a related field, at least 1 year of end-to-end recruitment experience.',
   'Familiarity with driver/frontline-role hiring requirements (licenses, clearances).',
   'published', (current_date + 42)::date),

  -- Administrative / Clerical
  ('Administrative Assistant', 'Administrative / Clerical', 'Cubao', 'Contractual', 2,
   'Provide general administrative support — document filing and processing, correspondence, scheduling, and office supply coordination.',
   'High school diploma, proficient with MS Office (Word, Excel), organized and detail-oriented.',
   'Associate''s degree, prior office/clerical experience.',
   'published', (current_date + 25)::date),
  ('Records & Documents Clerk', 'Administrative / Clerical', 'Cubao', 'Contractual', 1,
   'Maintain the company''s physical and digital filing systems — archive, retrieve, and control access to records while keeping confidential documents secure.',
   'High school diploma, strong attention to detail, basic computer literacy.',
   'Prior records management or archiving experience.',
   'published', (current_date + 26)::date),

  -- Security Guard
  ('Terminal Security Guard', 'Security Guard', 'Caloocan', 'Full-time', 3,
   'Maintain the safety and security of terminal premises, passengers, and property — monitor entry/exit points, conduct inspections, and respond to incidents.',
   'Valid security guard license, high school diploma, good moral character with no derogatory records.',
   'Military or police background.',
   'published', (current_date + 38)::date),
  ('Security Shift Supervisor', 'Security Guard', 'Cubao', 'Full-time', 1,
   'Lead a shift of terminal security guards, oversee incident reporting, and coordinate directly with local authorities when a situation requires escalation.',
   'Valid security guard license, at least 2 years of security experience, prior shift lead or supervisory experience.',
   'Military or police background, incident-report writing experience.',
   'published', (current_date + 46)::date),

  -- Safety & Compliance Inspector
  ('Vehicle Safety Inspector', 'Safety & Compliance Inspector', 'Cubao', 'Full-time', 2,
   'Conduct routine vehicle safety inspections, ensure fleet compliance with LTFRB/LTO regulations, and document and report safety findings.',
   'Bachelor''s degree in Engineering or a related field, working knowledge of LTFRB/LTO vehicle safety regulations.',
   'Experience in fleet safety compliance or vehicle inspection.',
   'published', (current_date + 42)::date),
  ('Road Safety & Compliance Officer', 'Safety & Compliance Inspector', 'Cubao', 'Full-time', 1,
   'Monitor driver behavior and route safety, conduct periodic safety audits, and investigate on-road incidents to recommend corrective action.',
   'Bachelor''s degree, working knowledge of LTFRB/LTO safety regulations, strong report-writing skills.',
   'Prior road safety auditing or incident investigation experience.',
   'published', (current_date + 49)::date),

  -- Information Technology
  ('IT Support Specialist', 'Information Technology', 'Cubao', 'Full-time', 2,
   'Provide first-line technical support for hardware, software, and network issues across terminal and office locations, and maintain ticketing/point-of-sale systems.',
   'Bachelor''s degree in Information Technology, Computer Science, or a related field, strong troubleshooting skills.',
   'Experience supporting ticketing systems, networking certifications (e.g. CompTIA Network+).',
   'published', (current_date + 36)::date),
  ('Network Administrator', 'Information Technology', 'Cubao', 'Full-time', 1,
   'Manage and maintain network infrastructure and connectivity across terminal and office locations, and respond to outages that affect ticketing or POS uptime.',
   'Bachelor''s degree in Information Technology or a related field, at least 2 years of network administration experience.',
   'CCNA or equivalent networking certification, experience maintaining multi-site connectivity.',
   'published', (current_date + 40)::date),
  ('Systems & POS Software Developer', 'Information Technology', 'Cubao', 'Full-time', 1,
   'Build and maintain the internal ticketing and point-of-sale systems used across terminals, fixing bugs and shipping small improvements as operational needs change.',
   'Bachelor''s degree in Computer Science, Information Technology, or a related field, working proficiency with SQL databases.',
   'Experience building or maintaining transactional/point-of-sale systems.',
   'published', (current_date + 48)::date),

  -- Marketing & Sales
  ('Marketing Associate', 'Marketing & Sales', 'Cubao', 'Full-time', 1,
   'Support marketing campaigns, social media content, and promotional events to grow brand awareness and ridership.',
   'Bachelor''s degree in Marketing, Communications, or a related field, comfortable creating content for social media.',
   'Experience with brand promotions, events, or digital marketing campaigns.',
   'published', (current_date + 55)::date),
  ('Corporate Sales & Partnerships Officer', 'Marketing & Sales', 'Cubao', 'Full-time', 1,
   'Develop and manage charter bookings, corporate accounts, and partnership deals to grow revenue outside of regular passenger ticketing.',
   'Bachelor''s degree in Business, Marketing, or a related field, at least 1 year of B2B sales or account management experience.',
   'Existing network of corporate or institutional contacts, negotiation experience.',
   'published', (current_date + 52)::date),

  -- Operations Supervisor / Management
  ('Terminal Operations Supervisor', 'Operations Supervisor / Management', 'Baguio', 'Full-time', 1,
   'Oversee daily terminal operations, supervise frontline staff, and ensure schedules, safety standards, and customer service targets are consistently met.',
   'Bachelor''s degree, at least 3 years of supervisory experience in transportation, logistics, or a related operations-heavy field.',
   'Experience managing a team of 10 or more, familiarity with LTFRB regulations.',
   'published', (current_date + 48)::date),
  ('Regional Operations Manager', 'Operations Supervisor / Management', 'Cubao', 'Full-time', 1,
   'Oversee operations across multiple terminals and routes in an assigned region, set performance targets, and manage a team of terminal supervisors toward them.',
   'Bachelor''s degree, at least 5 years of multi-site operations management experience, strong knowledge of transportation regulations.',
   'Master''s degree, prior P&L or budget ownership experience.',
   'published', (current_date + 58)::date)
) as v(title, category, location, employment_type, open_positions, description, required_qualifications, preferred_qualifications, status, application_deadline)
where not exists (select 1 from public.job_postings jp where jp.title = v.title);

-- Weighted screening criteria per job (1 = nice to have, 5 = critical) so
-- the AI resume-matching stage has a genuine rubric to score against for
-- every posting above, not just the original 15.
insert into public.criteria (job_id, keyword, weight)
select jp.id, c.keyword, c.weight
from (values
  ('Provincial Bus Driver', 'Professional driver''s license', 5),
  ('Provincial Bus Driver', 'Safe driving record', 5),
  ('Provincial Bus Driver', 'Defensive driving certification', 3),
  ('Provincial Bus Driver', 'Vehicle inspection knowledge', 3),

  ('City Route Bus Driver', 'Professional driver''s license', 5),
  ('City Route Bus Driver', 'Heavy urban traffic driving experience', 4),
  ('City Route Bus Driver', 'Safe driving record', 5),
  ('City Route Bus Driver', 'Customer courtesy', 3),

  ('Airport Express Bus Driver', 'Professional driver''s license', 5),
  ('Airport Express Bus Driver', 'Punctuality and schedule discipline', 4),
  ('Airport Express Bus Driver', 'Safe driving record', 5),
  ('Airport Express Bus Driver', 'Professional grooming and customer-facing demeanor', 3),
  ('Airport Express Bus Driver', 'Familiarity with expressway routes', 3),

  ('Bus Conductor', 'Customer service experience', 4),
  ('Bus Conductor', 'Fare handling / basic math', 4),
  ('Bus Conductor', 'Conflict de-escalation / passenger handling', 3),

  ('Senior Bus Conductor (Team Lead)', 'Prior bus conductor experience', 5),
  ('Senior Bus Conductor (Team Lead)', 'Team supervision / mentoring ability', 4),
  ('Senior Bus Conductor (Team Lead)', 'Cash reconciliation accuracy', 4),
  ('Senior Bus Conductor (Team Lead)', 'Conflict resolution skills', 3),

  ('Diesel Engine Mechanic', 'Diesel engine repair experience', 5),
  ('Diesel Engine Mechanic', 'TESDA NC II certification', 4),
  ('Diesel Engine Mechanic', 'Preventive maintenance scheduling knowledge', 3),

  ('Auto Electrician', 'Vehicle electrical systems experience', 5),
  ('Auto Electrician', 'TESDA Automotive Electrical NC II or equivalent', 4),
  ('Auto Electrician', 'Wiring/battery/lighting troubleshooting', 4),
  ('Auto Electrician', 'Willingness to work on-call for breakdowns', 2),

  ('Body & Chassis Technician', 'Welding and metal fabrication skills', 5),
  ('Body & Chassis Technician', 'Collision/body repair experience', 4),
  ('Body & Chassis Technician', 'TESDA NC II in Automotive Body/Chassis or equivalent', 3),
  ('Body & Chassis Technician', 'Attention to structural safety standards', 4),

  ('Terminal Operations Assistant', 'Willingness to work shifting schedule', 4),
  ('Terminal Operations Assistant', 'Terminal/logistics experience', 3),
  ('Terminal Operations Assistant', 'Composure under high passenger volume', 3),

  ('Terminal Operations Coordinator', 'Terminal operations experience', 5),
  ('Terminal Operations Coordinator', 'Cross-department coordination skills', 4),
  ('Terminal Operations Coordinator', 'Willingness to work shifting schedule', 4),
  ('Terminal Operations Coordinator', 'Problem-solving under pressure', 3),

  ('Trip Dispatcher', 'Scheduling software experience', 4),
  ('Trip Dispatcher', 'Logistics coordination experience', 4),
  ('Trip Dispatcher', 'Real-time decision-making under time pressure', 3),

  ('Fleet Scheduling Officer', 'Roster/shift planning experience', 5),
  ('Fleet Scheduling Officer', 'Scheduling or fleet management software proficiency', 4),
  ('Fleet Scheduling Officer', 'Strong organizational skills', 4),
  ('Fleet Scheduling Officer', 'DOLE labor scheduling rules knowledge', 3),

  ('Ticketing & Customer Service Representative', 'Customer service experience', 5),
  ('Ticketing & Customer Service Representative', 'Communication skills', 4),
  ('Ticketing & Customer Service Representative', 'Basic computer/ticketing system literacy', 3),

  ('Online Booking Support Agent', 'Chat/email support tool experience', 4),
  ('Online Booking Support Agent', 'Typing speed and written communication', 4),
  ('Online Booking Support Agent', 'Booking/payment issue troubleshooting', 4),
  ('Online Booking Support Agent', 'Patience with high inquiry volume', 3),

  ('Customer Relations Officer', 'Complaint handling / service recovery experience', 5),
  ('Customer Relations Officer', 'Written and verbal communication', 4),
  ('Customer Relations Officer', 'Composure in difficult conversations', 4),
  ('Customer Relations Officer', 'Refund/rebooking policy familiarity', 3),

  ('Terminal Cashier', 'Cash handling experience', 5),
  ('Terminal Cashier', 'POS system experience', 3),
  ('Terminal Cashier', 'Accuracy under pressure', 4),

  ('Senior Cashier / Cash Custodian', 'Cash handling and vault custody experience', 5),
  ('Senior Cashier / Cash Custodian', 'Reconciliation / auditing accuracy', 5),
  ('Senior Cashier / Cash Custodian', 'Supervisory experience over cashiering staff', 3),
  ('Senior Cashier / Cash Custodian', 'High integrity, no derogatory financial records', 4),

  ('Accounting Staff', 'Accounting/Finance degree', 5),
  ('Accounting Staff', 'QuickBooks experience', 3),
  ('Accounting Staff', 'Accounts payable/receivable processing experience', 4),

  ('Payroll Officer', 'Payroll processing experience', 5),
  ('Payroll Officer', 'SSS/PhilHealth/Pag-IBIG/BIR remittance knowledge', 5),
  ('Payroll Officer', 'Attention to detail with numbers', 4),
  ('Payroll Officer', 'Confidentiality with employee data', 3),

  ('Internal Audit Assistant', 'Bookkeeping or audit-support experience', 4),
  ('Internal Audit Assistant', 'Analytical / discrepancy-spotting skills', 5),
  ('Internal Audit Assistant', 'Accounting or Finance degree', 4),
  ('Internal Audit Assistant', 'Integrity and objectivity', 4),

  ('HR Generalist', 'PH labor law knowledge', 5),
  ('HR Generalist', 'Recruitment experience', 4),
  ('HR Generalist', 'Employee relations / conflict handling experience', 3),

  ('Recruitment Officer', 'End-to-end recruitment/sourcing experience', 5),
  ('Recruitment Officer', 'Interviewing and candidate screening skills', 4),
  ('Recruitment Officer', 'Driver/frontline hiring requirements familiarity', 3),
  ('Recruitment Officer', 'Organized applicant tracking / follow-through', 3),

  ('Administrative Assistant', 'MS Office proficiency', 4),
  ('Administrative Assistant', 'Office/clerical experience', 3),
  ('Administrative Assistant', 'Organizational and time-management skills', 3),

  ('Records & Documents Clerk', 'Filing and document management experience', 4),
  ('Records & Documents Clerk', 'Attention to detail and accuracy', 4),
  ('Records & Documents Clerk', 'Basic computer literacy', 3),
  ('Records & Documents Clerk', 'Handling confidential records responsibly', 3),

  ('Terminal Security Guard', 'Valid security guard license', 5),
  ('Terminal Security Guard', 'Military/police background', 2),
  ('Terminal Security Guard', 'Good moral character / no derogatory records', 4),

  ('Security Shift Supervisor', 'Prior security guard experience', 5),
  ('Security Shift Supervisor', 'Supervisory or team lead experience', 4),
  ('Security Shift Supervisor', 'Valid security guard license', 5),
  ('Security Shift Supervisor', 'Incident reporting / coordination with authorities', 3),

  ('Vehicle Safety Inspector', 'LTFRB/LTO regulation knowledge', 5),
  ('Vehicle Safety Inspector', 'Engineering degree', 4),
  ('Vehicle Safety Inspector', 'Vehicle inspection / roadworthiness assessment experience', 4),

  ('Road Safety & Compliance Officer', 'Road safety or compliance auditing experience', 5),
  ('Road Safety & Compliance Officer', 'Incident investigation skills', 4),
  ('Road Safety & Compliance Officer', 'LTFRB/LTO safety regulation knowledge', 4),
  ('Road Safety & Compliance Officer', 'Report writing skills', 3),

  ('IT Support Specialist', 'Hardware/software troubleshooting', 5),
  ('IT Support Specialist', 'Networking certification', 3),
  ('IT Support Specialist', 'Ticketing/POS system support experience', 3),

  ('Network Administrator', 'Network administration experience', 5),
  ('Network Administrator', 'CCNA or equivalent certification', 4),
  ('Network Administrator', 'Multi-site connectivity maintenance experience', 4),
  ('Network Administrator', 'On-call availability for outages', 2),

  ('Systems & POS Software Developer', 'Software development experience', 5),
  ('Systems & POS Software Developer', 'Ticketing/POS or transactional systems experience', 4),
  ('Systems & POS Software Developer', 'SQL database proficiency', 4),
  ('Systems & POS Software Developer', 'Debugging and troubleshooting skills', 3),

  ('Marketing Associate', 'Social media content creation', 4),
  ('Marketing Associate', 'Marketing/Communications degree', 3),
  ('Marketing Associate', 'Event/promotions coordination experience', 3),

  ('Corporate Sales & Partnerships Officer', 'B2B sales or account management experience', 5),
  ('Corporate Sales & Partnerships Officer', 'Negotiation skills', 4),
  ('Corporate Sales & Partnerships Officer', 'Marketing/Business degree', 3),
  ('Corporate Sales & Partnerships Officer', 'Relationship-building with corporate clients', 4),

  ('Terminal Operations Supervisor', 'Supervisory experience', 5),
  ('Terminal Operations Supervisor', 'Team management (10+)', 4),
  ('Terminal Operations Supervisor', 'LTFRB regulation familiarity', 3),

  ('Regional Operations Manager', 'Multi-site operations management experience', 5),
  ('Regional Operations Manager', 'Strategic planning / KPI-setting experience', 5),
  ('Regional Operations Manager', 'Leadership of supervisory staff', 4),
  ('Regional Operations Manager', 'Transportation regulation knowledge', 4)
) as c(title, keyword, weight)
join public.job_postings jp on jp.title = c.title
where not exists (select 1 from public.criteria cr where cr.job_id = jp.id and cr.keyword = c.keyword);
