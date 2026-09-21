Drop the recorded "Before You Start" walkthrough video here as:

    interview-instructions.mp4

The player on the interview instructions screen (src/pages/Interview.jsx)
already points at `/videos/interview-instructions.mp4` — nothing else needs
to change once the file exists. Until then, the player fails to load
silently and the screen just shows the existing text-only instructions
(see the video element's onError handler), so it's safe to ship this before
the file is actually recorded.

Suggested script (~35-45s):

"Before you start your video interview, here's what to expect.

Your questions stay hidden until you click Start — this keeps things fair,
so no one gets extra time to prepare or look anything up.

Once you click Start, you'll get 5 seconds to get ready, then 1 minute to
answer. Recording begins automatically after the countdown.

Not happy with a take? You get up to 3 attempts per question, whether you
re-record before or after submitting.

Right before your first question, we'll check that your camera and
microphone are actually working.

And once you submit an answer, that's final — HR reviews it after that, so
take your time on each take before hitting Submit.

Good luck!"
