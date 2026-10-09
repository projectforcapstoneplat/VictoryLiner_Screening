-- Victory Liner Careers — fake interview_responses + interview_evaluations
-- for the 10 test applicants currently sitting in Interview Stage/Advanced
-- (see seed_test_applicants.sql and seed_test_applicants_batch2.sql), so
-- their "Interview" score column fills in on HR's dashboards instead of
-- staying blank.
--
-- Known, accepted limitation: video_path below points to a storage path
-- that was never actually uploaded to — a real recorded clip can't be
-- faked. Clicking "Watch Answer" on any of these responses will not play a
-- real video. Everything else (the score, sentiment, explanation,
-- transcript) renders normally since those come straight from
-- interview_evaluations, not from the video file itself.
--
-- This is SAMPLE DATA, not a schema change — run once whenever you want
-- this layered onto the two applicant seed scripts. Safe to re-run: guarded
-- by `where not exists` on (application_id, question_id).

insert into public.interview_responses (application_id, question_id, video_path, status, submitted_at, attempt_count, question_text_snapshot)
select a.id, q.id,
       a.applicant_id::text || '/' || a.id::text || '/' || q.id::text || '.webm',
       -- Tied to each applicant's own interview_stage_at (set in the
       -- applicants seed files) rather than a flat offset, so the 4
       -- declined-after-interview applicants don't end up with a "submitted"
       -- video timestamped after their decline decision.
       'recorded', coalesce(a.interview_stage_at, a.created_at + interval '5 days'), 1, q.question_text
from (values
  -- Catherine Bautista — Accounting Staff
  ('catherine.bautista22@gmail.com', '441b9861-a34d-4ed7-8394-74871a51347c'::uuid),
  ('catherine.bautista22@gmail.com', 'a40ff08b-69f2-4b10-b053-b698f345510b'::uuid),
  ('catherine.bautista22@gmail.com', 'f69ba4d9-fcfd-422e-9211-d39df7fd6835'::uuid),
  -- Mark Anthony Garcia — Bus Conductor
  ('mark.garcia55@gmail.com', '41053800-d16b-42f2-92ce-f4d2a0eb0f61'::uuid),
  ('mark.garcia55@gmail.com', 'c8fde953-9075-467d-b4a1-6955322f310f'::uuid),
  ('mark.garcia55@gmail.com', 'f82dcaa3-69cb-4e16-af4f-512b5fa16f6a'::uuid),
  -- Joanna Mae Villanueva — Ticketing & Customer Service Representative
  ('joanna.villanueva33@gmail.com', '0138206c-1cba-4e96-b428-f4354d823e4b'::uuid),
  ('joanna.villanueva33@gmail.com', '51dfb2fb-6cbb-4bc7-9093-276e7acd5336'::uuid),
  ('joanna.villanueva33@gmail.com', '5c86d735-2cfe-44ae-8ae1-acc2a7cf1de2'::uuid),
  -- Ricardo Fernandez — Terminal Operations Assistant
  ('ricardo.fernandez41@gmail.com', 'aea99631-3983-4965-8486-b126220989b7'::uuid),
  ('ricardo.fernandez41@gmail.com', '72dddc65-8508-4bd7-aa6b-a306610967ff'::uuid),
  ('ricardo.fernandez41@gmail.com', '4dd54856-860f-4517-a741-aa0d38c1e2cf'::uuid),
  -- Patricia Ramos — HR Generalist
  ('patricia.ramos66@gmail.com', '130481f0-271c-4397-8626-1e13caadf737'::uuid),
  ('patricia.ramos66@gmail.com', '5e8009de-ef60-4e2b-bd63-69057ef7f795'::uuid),
  ('patricia.ramos66@gmail.com', '4a8e0ba3-73c1-496d-8675-c1490a42ae65'::uuid),
  -- Teresa Villareal — Regional Operations Manager
  ('teresa.villareal38@gmail.com', '60fe3214-107d-4e59-a7f1-a4331c78948b'::uuid),
  ('teresa.villareal38@gmail.com', 'f340824f-061c-4c4c-a60b-87333de79433'::uuid),
  ('teresa.villareal38@gmail.com', '568dfca2-808d-4536-b5ef-45e6263eb2b8'::uuid),
  -- Benedict Lopez — Vehicle Safety Inspector
  ('benedict.lopez51@gmail.com', '547e0221-b02d-44b1-b45b-ae97575c0b1d'::uuid),
  ('benedict.lopez51@gmail.com', 'd3db91dd-a343-4270-8633-c2e81d0202e4'::uuid),
  ('benedict.lopez51@gmail.com', 'c42df6a8-4284-481d-914c-7d9fda3fbe28'::uuid),
  -- Grace Fernandez — Payroll Officer
  ('grace.fernandez14@gmail.com', '441b9861-a34d-4ed7-8394-74871a51347c'::uuid),
  ('grace.fernandez14@gmail.com', 'a40ff08b-69f2-4b10-b053-b698f345510b'::uuid),
  ('grace.fernandez14@gmail.com', 'f69ba4d9-fcfd-422e-9211-d39df7fd6835'::uuid),
  -- Arnel Santiago — City Route Bus Driver
  ('arnel.santiago72@gmail.com', 'b4e22dce-38ed-44c4-b255-6ec8d246a9b2'::uuid),
  ('arnel.santiago72@gmail.com', '357888ad-e014-4c51-a185-1ebe18931d91'::uuid),
  ('arnel.santiago72@gmail.com', '2e27f8f8-55d3-461e-9e5e-e2d61a54a657'::uuid),
  -- Veronica Ocampo — Senior Cashier / Cash Custodian
  ('veronica.ocampo59@gmail.com', 'f840a40d-a425-4787-acec-019656a6c4e5'::uuid),
  ('veronica.ocampo59@gmail.com', '7ca2d3a0-53b4-44c1-90bf-6a4289d17b76'::uuid),
  ('veronica.ocampo59@gmail.com', 'f94d2ad8-6ade-407e-add5-0e8ef99277d9'::uuid),
  -- Noel Aquino — Terminal Security Guard (declined after interview)
  ('noel.aquino12@gmail.com', '98e01560-2754-4cec-ad88-564bf148e15c'::uuid),
  ('noel.aquino12@gmail.com', 'e022f70d-f680-483e-b5ef-b407e9c3282c'::uuid),
  ('noel.aquino12@gmail.com', '58bba86c-1a23-4d1c-84ba-87f4732bd955'::uuid),
  -- Liza Torres — Administrative Assistant (declined after interview)
  ('liza.torres88@gmail.com', 'faff0006-b4a2-4f09-a3cc-73d8fbaaedc8'::uuid),
  ('liza.torres88@gmail.com', 'da4611eb-600f-4ecb-bcbd-2bf40f301648'::uuid),
  ('liza.torres88@gmail.com', 'ae2be05a-6380-4592-8803-0e39f478e344'::uuid),
  -- Michelle Torres — Customer Relations Officer (declined after interview)
  ('michelle.torres26@gmail.com', '2b53b2e4-ed8a-4139-be43-580e5412cd22'::uuid),
  ('michelle.torres26@gmail.com', '0138206c-1cba-4e96-b428-f4354d823e4b'::uuid),
  ('michelle.torres26@gmail.com', 'd9f7ba41-bd78-4a2f-89be-1fa30e039118'::uuid),
  -- Henry Dizon — Recruitment Officer (declined after interview)
  ('henry.dizon83@gmail.com', 'c5435e02-c687-498a-b2b4-880c66cc8a12'::uuid),
  ('henry.dizon83@gmail.com', '4a8e0ba3-73c1-496d-8675-c1490a42ae65'::uuid),
  ('henry.dizon83@gmail.com', '421ffa5e-0b6a-4d37-b070-53cb5ba8744a'::uuid)
) as v(email, question_id)
join public.applications a on a.email = v.email
join public.interview_questions q on q.id = v.question_id
where not exists (
  select 1 from public.interview_responses r where r.application_id = a.id and r.question_id = q.id
);

insert into public.interview_evaluations (response_id, application_id, transcript, sentiment_label, sentiment_score, relevance_score, evaluation_score, explanation, model, evaluated_at)
select r.id, r.application_id, v.transcript, v.sentiment_label, v.sentiment_score, v.relevance_score, v.evaluation_score, v.explanation, 'gemini-3.6-flash', r.submitted_at + interval '3 minutes'
from (values
  ('catherine.bautista22@gmail.com', '441b9861-a34d-4ed7-8394-74871a51347c'::uuid,
   'I prioritize tasks by deadline and importance, usually starting with reconciliations early so I have buffer time if discrepancies come up. I also communicate with my supervisor early if I think a deadline might slip.',
   'positive', 85, 88, 86, 'Clear, structured approach to deadline management with proactive communication — directly relevant to month-end/year-end closing pressure.'),
  ('catherine.bautista22@gmail.com', 'a40ff08b-69f2-4b10-b053-b698f345510b'::uuid,
   'At my previous job I noticed a recurring discrepancy in our accounts payable ledger. I traced it back to a duplicate vendor entry, corrected it, and set up a monthly check to prevent it from happening again.',
   'positive', 82, 85, 83, 'Concrete example with a specific root cause and a preventive follow-up, showing real accounting judgment.'),
  ('catherine.bautista22@gmail.com', 'f69ba4d9-fcfd-422e-9211-d39df7fd6835'::uuid,
   'I keep our processes documented and aligned with company policy, double-check entries before submission, and make sure I stay updated on any changes announced by our finance team.',
   'neutral', 80, 84, 84, 'Solid, policy-aware answer, though somewhat general compared to the other two responses.'),

  ('mark.garcia55@gmail.com', '41053800-d16b-42f2-92ce-f4d2a0eb0f61'::uuid,
   'Two passengers were arguing over seating space. I calmly stepped in, acknowledged both sides, and helped one of them move to an open seat nearby so things could cool down.',
   'positive', 75, 76, 74, 'Practical de-escalation example appropriate to a conductor''s day-to-day reality.'),
  ('mark.garcia55@gmail.com', 'c8fde953-9075-467d-b4a1-6955322f310f'::uuid,
   'I use hand signals and short verbal cues so I don''t distract the driver, and I always let them know ahead of time if we''re approaching a stop with a lot of passengers.',
   'neutral', 68, 70, 68, 'Reasonable answer but light on specifics around communication protocol.'),
  ('mark.garcia55@gmail.com', 'f82dcaa3-69cb-4e16-af4f-512b5fa16f6a'::uuid,
   'I explain the correct fare clearly and politely. If they still refuse, I stay calm and explain company policy, and ask a supervisor for help if it escalates.',
   'neutral', 70, 72, 70, 'Appropriate escalation path, though the answer stays fairly surface-level.'),

  ('joanna.villanueva33@gmail.com', '0138206c-1cba-4e96-b428-f4354d823e4b'::uuid,
   'I had a passenger confused about a fare change, so I broke it down step by step and showed them the old versus new pricing side by side until it made sense to them.',
   'positive', 80, 82, 80, 'Clear, patient explanation technique well-suited to confused or frustrated travelers.'),
  ('joanna.villanueva33@gmail.com', '51dfb2fb-6cbb-4bc7-9093-276e7acd5336'::uuid,
   'During a holiday rush I focused on keeping a steady pace, double-checking each transaction quickly instead of rushing and making mistakes, and asked a colleague to help direct the line.',
   'positive', 77, 79, 77, 'Good balance of accuracy and speed under pressure, with sensible delegation.'),
  ('joanna.villanueva33@gmail.com', '5c86d735-2cfe-44ae-8ae1-acc2a7cf1de2'::uuid,
   'A customer was double-booked due to a system glitch. I verified it with my supervisor, canceled the duplicate, and rebooked them on the next available trip at no extra cost.',
   'positive', 81, 83, 80, 'Concrete resolution example that shows ownership and a customer-first outcome.'),

  ('ricardo.fernandez41@gmail.com', 'aea99631-3983-4965-8486-b126220989b7'::uuid,
   'When a route got rescheduled last minute, I quickly updated the boarding boards and informed the dispatch and ticketing teams so passengers wouldn''t be confused.',
   'positive', 88, 90, 89, 'Fast, cross-team response to a real last-minute schedule change — exactly the adaptability this role needs.'),
  ('ricardo.fernandez41@gmail.com', '72dddc65-8508-4bd7-aa6b-a306610967ff'::uuid,
   'During a delay caused by a mechanical issue, I coordinated between maintenance, dispatch, and the ticketing counter to keep passengers informed and arrange a replacement bus.',
   'positive', 85, 87, 85, 'Strong multi-department coordination example with a clear resolution.'),
  ('ricardo.fernandez41@gmail.com', '4dd54856-860f-4517-a741-aa0d38c1e2cf'::uuid,
   'I do regular walkthroughs to check for obstructions, make sure signage is clear, and report any safety hazards immediately to my supervisor.',
   'positive', 86, 88, 88, 'Proactive, routine-based approach to terminal safety and organization.'),

  ('patricia.ramos66@gmail.com', '130481f0-271c-4397-8626-1e13caadf737'::uuid,
   'I once handled a complaint about unfair shift assignments. I listened to both sides privately, reviewed the schedule records, and worked with the supervisor to adjust the rotation fairly.',
   'positive', 84, 86, 85, 'Thoughtful, fact-based approach to a sensitive employee relations issue.'),
  ('patricia.ramos66@gmail.com', '5e8009de-ef60-4e2b-bd63-69057ef7f795'::uuid,
   'I bring both employees together separately first to understand their side, then facilitate a joint conversation focused on finding a resolution rather than assigning blame.',
   'positive', 80, 82, 81, 'Sound conflict-resolution framework, balanced and professional in tone.'),
  ('patricia.ramos66@gmail.com', '4a8e0ba3-73c1-496d-8675-c1490a42ae65'::uuid,
   'I always refer back to our documented policies and apply them the same way regardless of position, and I keep records of decisions so there''s a clear, consistent precedent.',
   'neutral', 82, 84, 84, 'Policy-anchored and consistent, though a concrete example would have strengthened it further.'),

  ('teresa.villareal38@gmail.com', '60fe3214-107d-4e59-a7f1-a4331c78948b'::uuid,
   'I set realistic targets and check in regularly with supervisors to make sure the workload is sustainable, not just efficient on paper.',
   'positive', 78, 80, 81, 'People-aware management philosophy that balances output with staff well-being.'),
  ('teresa.villareal38@gmail.com', 'f340824f-061c-4c4c-a60b-87333de79433'::uuid,
   'When one of our terminals lost power during a storm, I coordinated backup arrangements with nearby terminals and kept both staff and passengers informed in real time.',
   'positive', 83, 85, 83, 'Real crisis example with decisive cross-site coordination.'),
  ('teresa.villareal38@gmail.com', '568dfca2-808d-4536-b5ef-45e6263eb2b8'::uuid,
   'I address underperformance early and privately, figure out whether it''s a skills gap or a motivation issue, and build an improvement plan with clear check-ins.',
   'neutral', 76, 78, 78, 'Reasonable management process, somewhat general without a specific past example.'),

  ('benedict.lopez51@gmail.com', '547e0221-b02d-44b1-b45b-ae97575c0b1d'::uuid,
   'I once found worn brake components that didn''t meet safety standards right before a unit was about to go out. I flagged it immediately and had it pulled from service even though it delayed the route.',
   'positive', 90, 92, 90, 'Strong safety-first judgment under real operational pressure, prioritizing compliance over schedule.'),
  ('benedict.lopez51@gmail.com', 'd3db91dd-a343-4270-8633-c2e81d0202e4'::uuid,
   'I follow a structured checklist covering brakes, tires, lights, and structural integrity, and I document every finding with photos for the record.',
   'positive', 84, 86, 85, 'Methodical, well-documented inspection process appropriate to the role.'),
  ('benedict.lopez51@gmail.com', 'c42df6a8-4284-481d-914c-7d9fda3fbe28'::uuid,
   'I noticed a unit was overdue for its LTFRB compliance documentation. I escalated it to management and made sure it was renewed before the unit was dispatched again.',
   'positive', 82, 84, 83, 'Concrete compliance catch with appropriate escalation and follow-through.'),

  ('grace.fernandez14@gmail.com', '441b9861-a34d-4ed7-8394-74871a51347c'::uuid,
   'During year-end closing I create a detailed checklist and work through it in priority order, and I flag any blockers to my team lead as early as possible instead of waiting.',
   'positive', 87, 89, 88, 'Structured, proactive deadline management well-suited to payroll''s cyclical crunch periods.'),
  ('grace.fernandez14@gmail.com', 'a40ff08b-69f2-4b10-b053-b698f345510b'::uuid,
   'I caught a miscalculation in an overtime computation that would''ve underpaid several employees. I corrected it before the payroll run and double-checked the formula going forward.',
   'positive', 85, 87, 85, 'High-stakes catch directly tied to employee pay accuracy, with a clear preventive fix.'),
  ('grace.fernandez14@gmail.com', 'f69ba4d9-fcfd-422e-9211-d39df7fd6835'::uuid,
   'I keep a monthly checklist for SSS, PhilHealth, Pag-IBIG, and BIR deadlines, and I cross-check remittance amounts against payroll reports before submission.',
   'positive', 86, 88, 87, 'Directly addresses the exact statutory remittance requirements this role is built around.'),

  ('arnel.santiago72@gmail.com', 'b4e22dce-38ed-44c4-b255-6ec8d246a9b2'::uuid,
   'During a heavy downpour I slowed down well below the usual speed, increased following distance, and used my hazard lights when visibility dropped, prioritizing passenger safety over the schedule.',
   'positive', 87, 89, 87, 'Sound, safety-first judgment in a real hazardous-weather scenario.'),
  ('arnel.santiago72@gmail.com', '357888ad-e014-4c51-a185-1ebe18931d91'::uuid,
   'I take short breaks when allowed, stay hydrated, and avoid driving when I feel fatigued — I''d rather report it than risk passenger safety.',
   'positive', 83, 85, 84, 'Self-aware fatigue management with the right safety-over-schedule instinct.'),
  ('arnel.santiago72@gmail.com', '2e27f8f8-55d3-461e-9e5e-e2d61a54a657'::uuid,
   'I check tires, brakes, lights, mirrors, and fluid levels first, then do a walk-around for any visible damage before I ever start the engine.',
   'positive', 88, 90, 89, 'Thorough, systematic pre-trip inspection process covering all the key safety points.'),

  ('veronica.ocampo59@gmail.com', 'f840a40d-a425-4787-acec-019656a6c4e5'::uuid,
   'During a rush I focus on one transaction at a time, acknowledge waiting customers so they know they haven''t been forgotten, and keep my pace steady instead of rushing and making errors.',
   'positive', 91, 93, 92, 'Composed, accuracy-first approach to high-volume periods, exactly what a cash custody role demands.'),
  ('veronica.ocampo59@gmail.com', '7ca2d3a0-53b4-44c1-90bf-6a4289d17b76'::uuid,
   'I once found a small shortage at closing. I recounted twice, reviewed the transaction log, found a miscounted bill in a prior transaction, and reported and corrected it the same day.',
   'positive', 85, 87, 86, 'Methodical discrepancy resolution with same-day reporting, showing strong reconciliation discipline.'),
  ('veronica.ocampo59@gmail.com', 'f94d2ad8-6ade-407e-add5-0e8ef99277d9'::uuid,
   'I count cash twice for every large transaction, use the bill counter when available, and reconcile my drawer against the register tape at the end of every shift.',
   'positive', 89, 91, 90, 'Rigorous, repeatable accuracy process directly aligned with vault custody responsibilities.'),

  ('noel.aquino12@gmail.com', '98e01560-2754-4cec-ad88-564bf148e15c'::uuid,
   'I noticed a damaged section of fencing near the back gate during my rounds and reported it right away to my supervisor and logged it in the incident book so maintenance could be scheduled.',
   'positive', 72, 74, 71, 'Prompt, properly-logged reporting — a sound habit, though it does not address the missing NBI clearance flagged at resume review.'),
  ('noel.aquino12@gmail.com', 'e022f70d-f680-483e-b5ef-b407e9c3282c'::uuid,
   'I keep doing regular rounds instead of staying in one spot, stay hydrated, and rotate my position every couple of hours so I stay sharp through a full shift.',
   'neutral', 65, 66, 64, 'Reasonable, generic vigilance habits without a concrete example to anchor them.'),
  ('noel.aquino12@gmail.com', '58bba86c-1a23-4d1c-84ba-87f4732bd955'::uuid,
   'A small fire started in a trash bin near the entrance. I used the fire extinguisher right away and alerted building admin while keeping people clear of the area.',
   'positive', 74, 75, 72, 'Decisive, correct emergency response with the right follow-up (alerting admin).'),

  ('liza.torres88@gmail.com', 'faff0006-b4a2-4f09-a3cc-73d8fbaaedc8'::uuid,
   'I list everything down and tackle the most time-sensitive items first, and I check in with my supervisor if two deadlines look like they will clash.',
   'neutral', 62, 64, 61, 'Sensible but generic prioritization habit, not grounded in an actual work example.'),
  ('liza.torres88@gmail.com', 'da4611eb-600f-4ecb-bcbd-2bf40f301648'::uuid,
   'During my internship I relabeled our storage folders by date instead of by random names, which made it faster to pull documents when someone needed them.',
   'positive', 68, 69, 66, 'Genuine small process improvement, though it comes from a short internship rather than real clerical employment.'),
  ('liza.torres88@gmail.com', 'ae2be05a-6380-4592-8803-0e39f478e344'::uuid,
   'I have mainly used MS Excel and Google Calendar for scheduling during school projects and my short internship.',
   'neutral', 60, 62, 59, 'Only school-project and internship-level tool exposure, underscoring the resume''s no-prior-work-experience gap.'),

  ('michelle.torres26@gmail.com', '2b53b2e4-ed8a-4139-be43-580e5412cd22'::uuid,
   'I stay calm, apologize for the inconvenience, and walk them through the options available, like rebooking on the next available trip.',
   'positive', 70, 72, 69, 'Composed, standard de-escalation script, appropriate but not distinctive.'),
  ('michelle.torres26@gmail.com', '0138206c-1cba-4e96-b428-f4354d823e4b'::uuid,
   'At the hotel front desk I had to explain a change in our cancellation policy to an upset guest, walking them through it slowly until it made sense to them.',
   'neutral', 66, 67, 64, 'Same front-desk-level example seen at resume review — clear communication, but still not the escalated service-recovery work this role calls for.'),
  ('michelle.torres26@gmail.com', 'd9f7ba41-bd78-4a2f-89be-1fa30e039118'::uuid,
   'I would explain the refund policy clearly and calmly, and if they are still upset I would call a supervisor to help settle it.',
   'neutral', 64, 65, 62, 'Reasonable escalation path, but defers the harder part of the conversation to a supervisor.'),

  ('henry.dizon83@gmail.com', 'c5435e02-c687-498a-b2b4-880c66cc8a12'::uuid,
   'I helped a senior recruiter inform an applicant they were not moving forward. I made sure to stay respectful and gave clear next steps.',
   'neutral', 63, 64, 61, 'Supportive role in a difficult conversation, but the senior recruiter still led it.'),
  ('henry.dizon83@gmail.com', '4a8e0ba3-73c1-496d-8675-c1490a42ae65'::uuid,
   'I always follow the checklist and guidelines given by our senior recruiters so every applicant goes through the same steps.',
   'neutral', 61, 62, 59, 'Consistent, but entirely procedure-following rather than policy ownership.'),
  ('henry.dizon83@gmail.com', '421ffa5e-0b6a-4d37-b070-53cb5ba8744a'::uuid,
   'I review resumes against the job requirements first, shortlist the closest matches, and pass them to the senior recruiter for the actual interview.',
   'neutral', 65, 66, 63, 'Same assistant-level ceiling flagged in the resume review — screening support, not end-to-end ownership.')
) as v(email, question_id, transcript, sentiment_label, sentiment_score, relevance_score, evaluation_score, explanation)
join public.applications a on a.email = v.email
join public.interview_responses r on r.application_id = a.id and r.question_id = v.question_id
where not exists (
  select 1 from public.interview_evaluations ie where ie.response_id = r.id
);
