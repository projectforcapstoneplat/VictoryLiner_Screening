-- Victory Liner Careers — seeds 5 interview questions for each of the 15
-- job categories (see supabase/migrations/0019_job_categories.sql), so
-- every published job can actually run its video-screening stage instead
-- of tripping the "No interview questions yet" alert in the HR notification
-- bell (see listPublishedJobsMissingQuestions in src/lib/interviewQuestions.js).
-- 5 per category also clears the "add more than the configured question
-- count" warning on the Interview Questions page (default is 3 — see
-- screening_settings.interview_question_count), so applicants actually get
-- a randomized subset instead of the same 3 every time.
--
-- Safe to re-run — the `where not exists` guard skips any (category,
-- question_text) pair that's already in the bank, same pattern as
-- seed_sample_jobs.sql.
--
-- Run once in the Supabase SQL editor.

insert into public.interview_questions (category, question_text)
select v.category, v.question_text
from (values
  ('Bus Driver', 'Describe a time you had to handle a difficult passenger. How did you resolve it?'),
  ('Bus Driver', 'How do you stay alert and focused during long driving shifts?'),
  ('Bus Driver', 'What would you do if you noticed a mechanical issue with your bus during a trip?'),
  ('Bus Driver', 'How do you handle traffic delays while trying to keep to a schedule?'),
  ('Bus Driver', 'Describe your approach to ensuring passenger safety at all times.'),

  ('Conductor', 'How do you handle a passenger who refuses to pay the correct fare?'),
  ('Conductor', 'Describe a time you had to de-escalate a conflict between passengers.'),
  ('Conductor', 'How do you keep track of passenger counts and fare collection accurately?'),
  ('Conductor', 'What would you do if you noticed a passenger who seemed to need assistance?'),
  ('Conductor', 'How do you communicate effectively with the bus driver during a trip?'),

  ('Mechanic / Maintenance Technician', 'Walk us through your process for diagnosing an engine problem.'),
  ('Mechanic / Maintenance Technician', 'Describe a time you had to complete an urgent repair under time pressure.'),
  ('Mechanic / Maintenance Technician', 'How do you prioritize tasks when multiple vehicles need maintenance at once?'),
  ('Mechanic / Maintenance Technician', 'What safety precautions do you always follow when working on a vehicle?'),
  ('Mechanic / Maintenance Technician', 'Tell us about a repair job that did not go as planned. What did you learn?'),

  ('Terminal Operations Staff', 'How do you manage a large crowd during peak hours at the terminal?'),
  ('Terminal Operations Staff', 'Describe a time you had to coordinate with multiple departments to resolve an issue.'),
  ('Terminal Operations Staff', 'What would you do if a scheduled bus was significantly delayed?'),
  ('Terminal Operations Staff', 'How do you handle passenger complaints at the terminal?'),
  ('Terminal Operations Staff', 'Describe how you ensure the terminal remains organized and safe.'),

  ('Dispatcher / Trip Scheduler', 'How do you handle last-minute changes to the trip schedule?'),
  ('Dispatcher / Trip Scheduler', 'Describe a time you had to resolve a scheduling conflict between routes.'),
  ('Dispatcher / Trip Scheduler', 'How do you communicate schedule changes to drivers and staff efficiently?'),
  ('Dispatcher / Trip Scheduler', 'What factors do you consider when assigning buses to routes?'),
  ('Dispatcher / Trip Scheduler', 'Tell us about a time you had to make a quick decision under pressure.'),

  ('Customer Service / Ticketing', 'How do you handle an upset customer who missed their bus?'),
  ('Customer Service / Ticketing', 'Describe a time you resolved a booking or ticketing error.'),
  ('Customer Service / Ticketing', 'How do you stay patient when dealing with a high volume of customer inquiries?'),
  ('Customer Service / Ticketing', 'What steps do you take to ensure accurate information is given to passengers?'),
  ('Customer Service / Ticketing', 'Tell us about a time you went above and beyond for a customer.'),

  ('Cashier / Teller', 'How do you ensure accuracy when handling cash transactions?'),
  ('Cashier / Teller', 'Describe a time you noticed a discrepancy in your cash drawer. What did you do?'),
  ('Cashier / Teller', 'How do you handle a long line of customers during peak hours?'),
  ('Cashier / Teller', 'What steps do you take to prevent fraud or errors at the counter?'),
  ('Cashier / Teller', 'Tell us about a time you had to explain a fare or policy to a confused customer.'),

  ('Accounting & Finance', 'Describe your experience with preparing financial reports.'),
  ('Accounting & Finance', 'How do you ensure accuracy when reconciling accounts?'),
  ('Accounting & Finance', 'Tell us about a time you identified and corrected a financial error.'),
  ('Accounting & Finance', 'How do you handle tight deadlines during month-end or year-end closing?'),
  ('Accounting & Finance', 'What steps do you take to ensure compliance with financial regulations?'),

  ('Human Resources', 'Describe a time you handled a sensitive employee relations issue.'),
  ('Human Resources', 'How do you approach resolving a conflict between two employees?'),
  ('Human Resources', 'What is your process for screening and interviewing candidates?'),
  ('Human Resources', 'How do you ensure fairness and consistency in HR policies?'),
  ('Human Resources', 'Tell us about a time you had to deliver difficult news to an employee.'),

  ('Administrative / Clerical', 'How do you prioritize multiple tasks with competing deadlines?'),
  ('Administrative / Clerical', 'Describe a time you improved a filing or record-keeping process.'),
  ('Administrative / Clerical', 'How do you handle confidential information?'),
  ('Administrative / Clerical', 'What tools or systems have you used for scheduling and documentation?'),
  ('Administrative / Clerical', 'Tell us about a time you caught an important error before it became a problem.'),

  ('Security Guard', 'How would you handle a confrontation with an unauthorized person on the premises?'),
  ('Security Guard', 'Describe a time you had to respond quickly to an emergency situation.'),
  ('Security Guard', 'What steps do you take during a routine security check?'),
  ('Security Guard', 'How do you stay alert and vigilant during long shifts?'),
  ('Security Guard', 'Tell us about a time you had to report a safety violation.'),

  ('Safety & Compliance Inspector', 'How do you conduct a thorough safety inspection?'),
  ('Safety & Compliance Inspector', 'Describe a time you identified a compliance issue and how you addressed it.'),
  ('Safety & Compliance Inspector', 'How do you stay updated on safety regulations and standards?'),
  ('Safety & Compliance Inspector', 'What would you do if you found a serious safety violation that could delay operations?'),
  ('Safety & Compliance Inspector', 'Tell us about a time you had to enforce a safety rule that was not popular.'),

  ('Information Technology', 'Describe a time you troubleshot a critical system issue under pressure.'),
  ('Information Technology', 'How do you approach securing sensitive company data?'),
  ('Information Technology', 'What steps do you take when rolling out a new system or software update?'),
  ('Information Technology', 'Tell us about a time you had to explain a technical issue to a non-technical colleague.'),
  ('Information Technology', 'How do you stay current with new technologies relevant to your role?'),

  ('Marketing & Sales', 'Describe a successful marketing campaign you contributed to.'),
  ('Marketing & Sales', 'How do you identify and reach a target audience?'),
  ('Marketing & Sales', 'Tell us about a time you had to meet a challenging sales target.'),
  ('Marketing & Sales', 'How do you handle rejection or a lost sales opportunity?'),
  ('Marketing & Sales', 'What strategies do you use to build long-term customer relationships?'),

  ('Operations Supervisor / Management', 'Describe how you motivate a team during a stressful period.'),
  ('Operations Supervisor / Management', 'Tell us about a time you had to make an unpopular operational decision.'),
  ('Operations Supervisor / Management', 'How do you handle underperformance within your team?'),
  ('Operations Supervisor / Management', 'What is your approach to balancing efficiency with employee well-being?'),
  ('Operations Supervisor / Management', 'Describe a time you had to manage a crisis or unexpected disruption in operations.')
) as v(category, question_text)
where not exists (
  select 1 from public.interview_questions iq
  where iq.category = v.category and iq.question_text = v.question_text
);
