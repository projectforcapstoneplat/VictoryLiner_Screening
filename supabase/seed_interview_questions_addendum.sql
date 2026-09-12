-- Victory Liner Careers — adds a 6th question to each of the 15 job
-- categories, on top of seed_interview_questions.sql's original 5. Brings
-- every category to at least 2 spares beyond the default question count (3)
-- so an applicant can reroll up to twice (see rerollQuestion in
-- src/lib/interview.js, MAX_ATTEMPTS in src/lib/interviewConstants.js)
-- without ever running out of unused questions.
--
-- Safe to re-run — skips anything already in the bank. Run after
-- seed_interview_questions.sql, once in the Supabase SQL editor.

insert into public.interview_questions (category, question_text)
select v.category, v.question_text
from (values
  ('Bus Driver', 'How do you handle a situation where you are running late and a passenger is anxious about missing a connection?'),
  ('Conductor', 'Describe how you would handle a passenger traveling with a lot of luggage in a crowded bus.'),
  ('Mechanic / Maintenance Technician', 'How do you decide whether a vehicle is safe to send back into service after a repair?'),
  ('Terminal Operations Staff', 'Describe a time you had to adapt quickly to a last-minute change in the terminal schedule.'),
  ('Dispatcher / Trip Scheduler', 'How do you balance driver rest requirements with meeting all scheduled trips?'),
  ('Customer Service / Ticketing', 'How would you handle a customer requesting a refund outside of policy?'),
  ('Cashier / Teller', 'Describe a time you had to stay composed while handling multiple customers at once.'),
  ('Accounting & Finance', 'How do you approach budgeting or forecasting for a department?'),
  ('Human Resources', 'How do you handle a situation where a hiring manager wants to skip part of the screening process?'),
  ('Administrative / Clerical', 'Describe a time you had to learn a new software tool quickly for your job.'),
  ('Security Guard', 'How do you balance being approachable to the public while remaining vigilant?'),
  ('Safety & Compliance Inspector', 'Describe a time you had to communicate a compliance requirement to a resistant team.'),
  ('Information Technology', 'Describe your approach to documenting IT processes or solutions so others on the team can follow them.'),
  ('Marketing & Sales', 'Describe a time you had to adjust a campaign based on performance data.'),
  ('Operations Supervisor / Management', 'How do you ensure smooth communication between frontline staff and upper management?')
) as v(category, question_text)
where not exists (
  select 1 from public.interview_questions iq
  where iq.category = v.category and iq.question_text = v.question_text
);
