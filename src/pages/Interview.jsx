// Applicant — record video answers to the questions assigned to this
// application (count is HR Head-configurable, see screening_settings), one
// at a time, using the browser's camera + mic.
import { useEffect, useRef, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Stepper } from '../components/navigation/Stepper/Stepper.jsx';
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';
import { ensureAssignedResponses, uploadResponseVideo, translateToTaglish, recordAttempt, justCompletedInterview, rerollQuestion } from '../lib/interview.js';
import { notifyHrInterviewCompleted } from '../lib/applications.js';
import { evaluateResponse } from '../lib/interviewEvaluation.js';
import { saveRecoveryChunks, loadRecoveryChunks, clearRecoveryChunks } from '../lib/videoRecoveryStore.js';
import { getScreeningSettings } from '../lib/screeningSettings.js';
import { MAX_ATTEMPTS } from '../lib/interviewConstants.js';

const READY_SECONDS = 5;
const RECORD_SECONDS = 60;

const ARROW_LEFT_ICON = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;

const INFO_ICON_PROPS = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--action-primary-bg)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const INFO_ICONS = {
  eye: <svg {...INFO_ICON_PROPS}><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  clock: <svg {...INFO_ICON_PROPS}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>,
  redo: <svg {...INFO_ICON_PROPS}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>,
  camera: <svg {...INFO_ICON_PROPS}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3" /></svg>,
  check: <svg {...INFO_ICON_PROPS}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>,
};

// What used to be one small line of prose under the H1 — easy to skim past,
// easy to be blindsided mid-question by (attempt limits, the hidden-question
// rule, etc.). Applicants now have to actually pass through this as its own
// screen before the camera check even loads, see InterviewInstructions below.
const INTERVIEW_INSTRUCTIONS = [
  { icon: 'eye', title: 'Questions stay hidden until you click Start', body: 'This keeps things fair for every applicant — nobody gets extra time to prepare or look up an answer beforehand.' },
  { icon: 'clock', title: '5 seconds to prepare, then 1 minute to answer', body: 'Once you click Start, a short countdown gives you a moment to get ready before recording begins automatically.' },
  { icon: 'redo', title: `Up to ${MAX_ATTEMPTS} attempts per question`, body: 'Not happy with a take? Re-record — before or after submitting — up to 3 times total for that one question.' },
  { icon: 'camera', title: "We'll check your camera & mic first", body: "Right after this, you'll confirm HR can actually see and hear you before any question starts recording." },
  { icon: 'check', title: 'Once every question is submitted, HR reviews it', body: "There's no editing an answer after that — take your time on each take before hitting Submit." },
];

// A gate, not just information — the applicant has to click through this
// screen before DeviceCheck even loads, so the rules (hidden questions,
// timing, attempt limits) are seen once, deliberately, instead of sitting in
// a paragraph easy to skip past on the way to starting.
function InterviewInstructions({ onContinue }) {
  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: 'clamp(28px, 5vw, 48px)', display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 520 }}>
        <strong style={{ fontSize: 'var(--text-xl)' }}>Before You Start — How This Works</strong>
        <p style={{ margin: '8px 0 0', fontSize: 'var(--text-sm)', opacity: 0.7 }}>
          Please read through this once — it covers everything you need to know so nothing catches you off guard mid-question.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 560 }}>
        {INTERVIEW_INSTRUCTIONS.map((item) => (
          <div key={item.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', textAlign: 'left' }}>
            <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {INFO_ICONS[item.icon]}
            </span>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{item.title}</div>
              <div style={{ fontSize: 'var(--text-sm)', opacity: 0.7, marginTop: 2 }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>
      <Button variant="strong" size="md" onClick={onContinue} style={{ width: 'auto', minWidth: 260 }}>I Understand — Continue</Button>
    </div>
  );
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// "No transcript" reads as a bug (that was the exact complaint that led
// here) when it could instead say *why* — most of these codes come from
// Chrome's SpeechRecognition needing to reach Google's servers to work at
// all, so a blocked/flaky connection is a very plausible real-world cause.
function transcriptFallbackMessage(errorCode) {
  if (errorCode === 'network') {
    return "Couldn't reach the transcript service (needs an internet connection) — doesn't affect your submission.";
  }
  if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
    return "Transcript preview needs microphone permission for this site — doesn't affect your submission.";
  }
  if (errorCode === 'audio-capture') {
    return "Couldn't read your microphone for the transcript preview — doesn't affect your submission.";
  }
  return "We couldn't make out a clear transcript for this take — doesn't affect your submission.";
}

// The "get ready" countdown used to be a plain sentence — a ring reads at a
// glance and actually communicates urgency as it drains, the way a real
// camera app's countdown does.
function CountdownRing({ secondsLeft, totalSeconds }) {
  const size = 108;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - secondsLeft / totalSeconds);
  return (
    <div className="interview-ring-pulse" style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#fff" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-4xl)', fontWeight: 800, color: '#fff' }}>
        {secondsLeft}
      </div>
    </div>
  );
}

// Live mic input level, read via Web Audio's AnalyserNode — moves in
// response to actual sound so an applicant can confirm their mic works
// before starting, not just that a device is plugged in.
function MicLevelMeter({ stream }) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const audioTrack = stream?.getAudioTracks()[0];
    if (!audioTrack) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setLevel(Math.min(100, Math.round((avg / 160) * 100)));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      ctx.close();
    };
  }, [stream]);

  const good = level > 8;
  return (
    <div>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 6 }}>Microphone</div>
      <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-page-alt)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${level}%`, background: good ? '#1a7f37' : 'var(--gray-400)', transition: 'width 0.1s linear' }} />
      </div>
      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 6, color: good ? '#1a7f37' : 'inherit' }}>
        {good ? 'Mic is picking up sound ✓' : 'Say something out loud — this bar should move'}
      </div>
    </div>
  );
}

// Samples the live video frame onto a tiny offscreen canvas and averages
// perceived luminance — a real reading of whether the applicant is actually
// visible, not just that a camera is connected.
function LightingMeter({ videoRef }) {
  const [brightness, setBrightness] = useState(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 24;
    const ctx = canvas.getContext('2d');
    let raf;
    const tick = () => {
      const videoEl = videoRef.current;
      if (videoEl && videoEl.readyState >= 2) {
        ctx.drawImage(videoEl, 0, 0, 32, 24);
        const { data } = ctx.getImageData(0, 0, 32, 24);
        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        }
        setBrightness(total / (data.length / 4));
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);

  let label = 'Checking…';
  let color = 'inherit';
  if (brightness !== null) {
    if (brightness < 55) {
      label = 'Too dark — try facing a light source';
      color = 'var(--red-700)';
    } else if (brightness > 220) {
      label = 'Too bright — reduce glare or backlight';
      color = 'var(--red-700)';
    } else {
      label = 'Lighting looks good ✓';
      color = '#1a7f37';
    }
  }

  return (
    <div>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 6 }}>Lighting</div>
      <div style={{ fontSize: 'var(--text-sm)', color, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// One-time gate before the question list — confirms camera, mic, and
// lighting all work before the applicant starts an actual timed answer,
// instead of finding out mid-question.
function DeviceCheck({ onContinue }) {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const videoRef = useRef(null);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((s) => {
        if (active) setStream(s);
        else s.getTracks().forEach((t) => t.stop());
      })
      .catch(() => setError('Could not access your camera/microphone. Check your browser permissions and try again.'));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);

  const handleContinue = () => {
    stream?.getTracks().forEach((t) => t.stop());
    onContinue();
  };

  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: 'clamp(24px, 5vw, 40px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <strong style={{ fontSize: 'var(--text-lg)' }}>Check Your Camera &amp; Mic</strong>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', opacity: 0.75 }}>
          Before you start, make sure HR can clearly see and hear you. Face a light source and say something out loud to test your mic.
        </p>
      </div>
      {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
      {stream && (
        <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', borderRadius: 8, background: '#000' }} />
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', textAlign: 'left' }}>
            <div style={{ flex: 1, minWidth: 180 }}><MicLevelMeter stream={stream} /></div>
            <div style={{ flex: 1, minWidth: 180 }}><LightingMeter videoRef={videoRef} /></div>
          </div>
        </div>
      )}
      <Button variant="strong" size="sm" onClick={handleContinue} disabled={!stream}>Continue to Questions</Button>
    </div>
  );
}

// locked -> countdown -> recording -> preview -> submitted
// The question text stays hidden (and no camera is requested) until the
// applicant clicks Start — so there's no window to read the question and go
// search for an answer before recording. Once revealed, a 5-second "get
// ready" countdown auto-starts recording, which auto-stops after 1 minute.
function AnswerRecorder({ response, index, total, applicantId, applicationId, jobCategory, usedQuestionIds, onSubmitted, onRerolled }) {
  const [mode, setMode] = useState(response.video_path ? 'submitted' : 'locked');
  const [revealed, setRevealed] = useState(!!response.video_path);
  const [stream, setStream] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [requestingCamera, setRequestingCamera] = useState(false);
  const [readySecondsLeft, setReadySecondsLeft] = useState(READY_SECONDS);
  const [recordSecondsLeft, setRecordSecondsLeft] = useState(RECORD_SECONDS);
  const [taglish, setTaglish] = useState(null);
  const [showTaglish, setShowTaglish] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState('');
  const [attemptCount, setAttemptCount] = useState(response.attempt_count || 0);
  const [rerolling, setRerolling] = useState(false);
  const [rerollNotice, setRerollNotice] = useState('');
  const [recovery, setRecovery] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [transcriptAttempted, setTranscriptAttempted] = useState(false);
  const [transcriptErrorCode, setTranscriptErrorCode] = useState('');

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  // Checks for a locally-backed-up recording from a session that got cut
  // off (lost connection, crashed tab, sudden power loss) before it could
  // upload — offered back to the applicant instead of silently discarded.
  useEffect(() => {
    if (response.video_path) {
      clearRecoveryChunks(applicationId, response.question_id);
      return;
    }
    loadRecoveryChunks(applicationId, response.question_id).then((found) => {
      if (found?.chunks?.length) setRecovery(found);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warns before an accidental close/refresh mid-recording — the one kind
  // of interruption this can actually catch and prevent, unlike a real
  // power loss or connection drop.
  useEffect(() => {
    if (mode !== 'countdown' && mode !== 'recording') return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [mode]);

  // Best-effort, in-browser speech-to-text so the applicant can proofread
  // what they actually said before deciding to submit or re-record —
  // separate from (and much lower-stakes than) the AI transcript HR sees
  // later, which comes from a real server-side model. Chrome/Edge only
  // (same as the video recording requirement below).
  //
  // interimResults is on so text appears live rather than waiting on a
  // "final" chunk that (in continuous mode) sometimes never fires if the
  // applicant talks straight through without a clean pause — an earlier
  // version used interimResults:false and could end up showing nothing for
  // an entire 60s take even though recognition was working. onend also
  // restarts recognition (it can stop itself early on a brief silence gap
  // even with continuous:true) so it keeps listening for the full take
  // instead of going quiet after the first pause.
  const startSpeechRecognition = () => {
    setLiveTranscript('');
    setTranscriptAttempted(false);
    setTranscriptErrorCode('');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let finalText = '';
    let keepAlive = true;
    // If it's failing instantly on every restart (e.g. no route to the
    // recognition service at all) this stops it from spinning start/error/
    // end in a tight loop for the rest of the 60s take.
    let consecutiveFailures = 0;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
      consecutiveFailures = 0;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += `${chunk} `;
        else interim += chunk;
      }
      setLiveTranscript(`${finalText}${interim}`.trim());
    };
    recognition.onerror = (e) => {
      // Surfaced in the console (not to the applicant directly) so this is
      // actually diagnosable instead of a silent black box — 'network' most
      // likely means the browser couldn't reach Chrome's speech service at
      // all (this feature calls out to Google's servers, it isn't local).
      console.warn('[interview transcript] speech recognition error:', e.error);
      setTranscriptErrorCode(e.error);
      consecutiveFailures += 1;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'language-not-supported' || consecutiveFailures >= 5) {
        keepAlive = false;
      }
    };
    recognition.onend = () => {
      if (keepAlive && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          /* already running */
        }
      }
    };
    try {
      recognition.start();
      recognitionRef.current = recognition;
      setTranscriptAttempted(true);
    } catch {
      recognitionRef.current = null;
    }
  };

  const stopSpeechRecognition = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try {
      recognition?.stop();
    } catch {
      /* already stopped */
    }
  };

  const startRecording = () => {
    chunksRef.current = [];
    let recorder;
    try {
      if (!MediaRecorder.isTypeSupported('video/webm')) throw new Error('unsupported');
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    } catch {
      setError('Video recording is not supported in this browser. Try Chrome or Edge instead.');
      setMode('locked');
      return;
    }
    recorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      chunksRef.current.push(e.data);
      // Backs up what's been recorded so far every ~1s (the timeslice below)
      // rather than only at the end — so a sudden interruption mid-recording
      // only loses the last second, not the whole take.
      saveRecoveryChunks(applicationId, response.question_id, [...chunksRef.current]);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setMode('preview');
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      stopSpeechRecognition();
    };
    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setRecordSecondsLeft(RECORD_SECONDS);
    setMode('recording');
    startSpeechRecognition();

    const nextAttempt = attemptCount + 1;
    setAttemptCount(nextAttempt);
    recordAttempt(applicationId, response.question_id, nextAttempt);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // Drives the 5-second "get ready" countdown, then hands off to recording.
  useEffect(() => {
    if (mode !== 'countdown') return;
    if (readySecondsLeft <= 0) {
      startRecording();
      return;
    }
    const t = setTimeout(() => setReadySecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, readySecondsLeft]);

  // Drives the 60-second recording countdown, auto-stopping at 0.
  useEffect(() => {
    if (mode !== 'recording') return;
    if (recordSecondsLeft <= 0) {
      stopRecording();
      return;
    }
    const t = setTimeout(() => setRecordSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, recordSecondsLeft]);

  const beginCountdown = async () => {
    setError('');
    setRequestingCamera(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(s);
      setRevealed(true);
      setReadySecondsLeft(READY_SECONDS);
      setMode('countdown');
    } catch {
      setError('Could not access your camera/microphone. Check your browser permissions and try again.');
    }
    setRequestingCamera(false);
  };

  // Hands back a different, not-yet-used question instead of re-asking the
  // same one — otherwise "re-record" would just be a free chance to prepare
  // a rehearsed answer for a question the applicant has now already seen
  // once. Falls back to a plain re-record of the same question only if the
  // category's bank has nothing left to swap to (see rerollQuestion's own
  // comment in src/lib/interview.js).
  const reRecord = async () => {
    if (attemptCount >= MAX_ATTEMPTS) return;
    setRerolling(true);
    setError('');
    setRerollNotice('');
    const { data, error: rerollErr } = await rerollQuestion(applicationId, response.question_id, jobCategory, usedQuestionIds);
    setRerolling(false);
    if (rerollErr) {
      if (rerollErr.code === 'no_spare_questions') {
        setRerollNotice("No other questions available yet — you'll re-record this same one.");
      } else {
        setError(rerollErr.message || 'Could not load a new question. Please try again.');
        return;
      }
    } else {
      onRerolled(data);
    }
    setRecordedBlob(null);
    setTaglish(null);
    setShowTaglish(false);
    setLiveTranscript('');
    setTranscriptAttempted(false);
    beginCountdown();
  };

  const submit = async () => {
    // Final attempt — once this uploads, neither re-record nor reroll is
    // offered again for this question (see atAttemptLimit below), so this
    // is the applicant's last chance to back out and re-watch their take
    // before it's locked in.
    if (attemptCount >= MAX_ATTEMPTS) {
      const proceed = window.confirm("This is your last attempt for this question — once submitted, you won't be able to re-record or try a different question here. Submit this answer as final?");
      if (!proceed) return;
    }
    setUploading(true);
    setError('');
    const { data, error: uploadError } = await uploadResponseVideo({
      applicantId,
      applicationId,
      questionId: response.question_id,
      blob: recordedBlob,
    });
    setUploading(false);
    if (uploadError) {
      setError(uploadError.message || 'Upload failed. Check your connection and try again.');
      return;
    }
    clearRecoveryChunks(applicationId, response.question_id);
    setMode('submitted');
    onSubmitted(data);
    // Best-effort, fire-and-forget — evaluates this answer right now instead
    // of leaving it until HR happens to open this applicant's row. Not
    // awaited: the applicant moves on immediately, scoring happens in the
    // background. A failure here just means this one answer waits for HR's
    // own on-open evaluation later (see loadDetail in HrApplicantsList.jsx),
    // same as it always has.
    evaluateResponse(data.id);
  };

  const resumeRecovery = () => {
    const blob = new Blob(recovery.chunks, { type: 'video/webm' });
    setRecordedBlob(blob);
    setRevealed(true);
    setMode('preview');
    setRecovery(null);
  };

  const discardRecovery = () => {
    clearRecoveryChunks(applicationId, response.question_id);
    setRecovery(null);
  };

  const handleTranslate = async () => {
    if (taglish) {
      setShowTaglish((v) => !v);
      return;
    }
    setTranslating(true);
    setTranslateError('');
    const { data, error: tError } = await translateToTaglish(response.question_text_snapshot || response.interview_questions?.question_text || '');
    setTranslating(false);
    if (tError) {
      setTranslateError(tError);
      return;
    }
    setTaglish(data);
    setShowTaglish(true);
  };

  // The snapshot taken when this question was assigned — not the live
  // question bank, so this applicant sees the exact wording they were
  // actually given even if HR edits the question afterward.
  const questionText = response.question_text_snapshot || response.interview_questions?.question_text;
  const displayedQuestion = showTaglish && taglish ? taglish : questionText;
  const attemptsLeft = MAX_ATTEMPTS - attemptCount;
  const atAttemptLimit = attemptCount >= MAX_ATTEMPTS;

  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>
          Question {index + 1} of {total}{revealed && ` — Attempt ${Math.min(attemptCount, MAX_ATTEMPTS)} of ${MAX_ATTEMPTS}`}
        </div>
        {revealed && (
          <Button variant="ghost" size="sm" onClick={handleTranslate} disabled={translating}>
            {translating ? 'Translating…' : showTaglish ? 'Show Original' : '🌐 Translate to Taglish'}
          </Button>
        )}
      </div>

      {recovery && (
        <div style={{ background: 'var(--pink-100)', borderRadius: 'var(--radius-sm)', padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--red-700)' }}>
            We found a recording for this question from before an interruption. Resume it, or discard and start over?
          </span>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Button variant="strong" size="sm" onClick={resumeRecovery}>Resume Recording</Button>
            <Button variant="ghost" size="sm" onClick={discardRecovery}>Discard</Button>
          </div>
        </div>
      )}

      {!revealed ? (
        atAttemptLimit && !recovery ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--red-700)' }}>
            You've used all {MAX_ATTEMPTS} attempts for this question without a submitted answer. Contact HR for help.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginTop: 0, opacity: 0.6, fontStyle: 'italic' }}>
              This question stays hidden until you start — that keeps things fair for every applicant.
            </p>
            {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)', marginBottom: 10 }}>{error}</div>}
            <Button variant="strong" size="sm" onClick={beginCountdown} disabled={requestingCamera || !!recovery}>
              {requestingCamera ? 'Starting Camera…' : 'Start Question'}
            </Button>
          </>
        )
      ) : (
        <div className="fade-in-up">
          <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginTop: 0 }}>{displayedQuestion}</p>
          {translateError && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)', marginBottom: 8 }}>{translateError}</div>}
          {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)', marginBottom: 10 }}>{error}</div>}
          {rerollNotice && <div style={{ color: 'var(--text-primary)', opacity: 0.65, fontSize: 'var(--text-xs)', marginBottom: 10 }}>{rerollNotice}</div>}

          {mode === 'submitted' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--red-700)' }}>✓ Answer submitted</span>
              {atAttemptLimit ? (
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>You've used all {MAX_ATTEMPTS} attempts for this question.</span>
              ) : (
                <Button variant="ghost" size="sm" onClick={reRecord} disabled={rerolling}>{rerolling ? 'Loading New Question…' : `Try a Different Question (${attemptsLeft} left)`}</Button>
              )}
            </div>
          )}

          {(mode === 'countdown' || mode === 'recording') && (
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <div style={{ position: 'relative' }}>
                <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', borderRadius: 8, background: '#000', display: 'block' }} />
                {mode === 'countdown' && (
                  <div className="fade-in-up" style={{
                    position: 'absolute', inset: 0, borderRadius: 8, background: 'rgba(15,10,10,0.55)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                  }}>
                    <CountdownRing secondsLeft={readySecondsLeft} totalSeconds={READY_SECONDS} />
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#fff' }}>Get ready…</span>
                  </div>
                )}
              </div>
              {mode === 'recording' && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--red-700)' }}>
                      <span className="recording-dot-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red-700)' }} />
                      Recording — {formatTime(recordSecondsLeft)} left
                    </span>
                    <Button variant="strong" size="sm" onClick={stopRecording}>■ Stop</Button>
                  </div>
                  <div style={{ marginTop: 8, height: 5, borderRadius: 999, background: 'var(--surface-page-alt)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(recordSecondsLeft / RECORD_SECONDS) * 100}%`, background: 'var(--red-700)', transition: 'width 1s linear' }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'preview' && recordedBlob && (
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <video src={URL.createObjectURL(recordedBlob)} controls style={{ width: '100%', borderRadius: 8, background: '#000' }} />
              {transcriptAttempted && (
                <div style={{ marginTop: 10, background: 'var(--surface-page-alt)', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, opacity: 0.65 }}>
                    What we heard (auto-generated — for your reference only, not what HR sees)
                  </div>
                  {liveTranscript ? (
                    <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>&ldquo;{liveTranscript}&rdquo;</p>
                  ) : (
                    <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', opacity: 0.6 }}>{transcriptFallbackMessage(transcriptErrorCode)}</p>
                  )}
                </div>
              )}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="strong" size="sm" onClick={submit} disabled={uploading}>{uploading ? 'Submitting…' : 'Submit Answer'}</Button>
                {atAttemptLimit ? (
                  <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>You've used all {MAX_ATTEMPTS} attempts — this take is final.</span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={reRecord} disabled={uploading || rerolling}>{rerolling ? 'Loading New Question…' : `Try a Different Question (${attemptsLeft} left)`}</Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Used to be a single plain red sentence tacked onto the bottom of the
// question list — the actual "you're finished" payoff moment deserves more
// than that, same treatment as the app's other empty/complete states
// (e.g. JobMatches.jsx's "no matches" card).
function InterviewComplete({ nav }) {
  return (
    <Reveal className="hover-lift" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '44px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div className="chip-pop" style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 13 4 4L19 7" />
        </svg>
      </div>
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>You're All Done!</h2>
      <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, maxWidth: 420, margin: 0 }}>
        Every question has been answered and submitted. HR will review your interview along with your application — no further action needed from you.
      </p>
      <Button variant="strong" size="sm" onClick={() => nav('my-applications')}>Back to My Applications</Button>
    </Reveal>
  );
}

export function Interview({ application, profile, nav }) {
  const [responses, setResponses] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [instructionsAcknowledged, setInstructionsAcknowledged] = useState(false);
  const [deviceCheckPassed, setDeviceCheckPassed] = useState(false);

  useEffect(() => {
    if (!application?.id) return;
    const category = application.job_postings?.category || '';
    getScreeningSettings().then(({ data: settings }) => {
      const questionCount = settings?.interview_question_count;
      ensureAssignedResponses(application, category, questionCount).then(({ data, error }) => {
        if (error) {
          setLoadError(`Could not load your interview questions: ${error.message || JSON.stringify(error)}`);
          setResponses([]);
          return;
        }
        setResponses(data);
      });
    });
  }, [application]);

  const handleSubmitted = (updated) => {
    setResponses((rs) => {
      const next = rs.map((r) => (r.question_id === updated.question_id ? updated : r));
      if (justCompletedInterview(rs, next)) notifyHrInterviewCompleted(application.id);
      return next;
    });
  };

  // Matched by the response row's own stable id, not question_id — that's
  // exactly the field a reroll changes, so matching on it here would never
  // find the row to replace.
  const handleRerolled = (updated) => {
    setResponses((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
  };

  const backButton = (
    <button
      onClick={() => nav('my-applications')}
      className="btn-animate"
      style={{
        display: 'flex', alignItems: 'center', gap: 7, width: 'fit-content', margin: '0 auto 20px',
        padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        background: 'var(--surface-card)', boxShadow: 'var(--shadow-card)', color: 'var(--text-primary)', fontSize: 'var(--text-xs)', fontWeight: 700,
      }}
    >
      {ARROW_LEFT_ICON} Back to My Applications
    </button>
  );

  if (!application) {
    return (
      <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
        <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header links={[]} /></div>
        <section style={{ maxWidth: 1000, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
          {backButton}
          <p>No application selected.</p>
        </section>
      </div>
    );
  }

  const allSubmitted = responses?.length > 0 && responses.every((r) => r.video_path);

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header links={[]} /></div>
      <section style={{ maxWidth: 1000, margin: '60px auto', padding: '0 20px' }}>
        {backButton}
        {/* Mirrors MyApplications.jsx's getStepIndex exactly: still on
            "Video Screening" (index 2) until every question actually has a
            recorded answer, only crossing into "Reviewing" (index 3) once
            allSubmitted — this page had been hardcoded to 3 for the whole
            duration, showing "Reviewing" as already current before the
            applicant had recorded a single answer. */}
        <div style={{ marginBottom: 40, padding: '0 clamp(8px, 4vw, 40px)' }}><Stepper current={allSubmitted ? 3 : 2} /></div>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <h1 style={{ fontWeight: 600, fontSize: 'var(--text-3xl)', margin: '0 0 8px' }}>Video Interview — {application.job_postings?.title}</h1>
          <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, margin: 0 }}>Take your time — everything you need to know is on the next screen.</p>
        </div>

        {loadError && <p style={{ color: 'var(--red-700)' }}>{loadError}</p>}

        {responses === null ? (
          <p style={{ textAlign: 'center' }}>Loading your questions…</p>
        ) : responses.length === 0 ? (
          <p style={{ textAlign: 'center' }}>Interview questions haven't been set up for this role's category yet — check back later.</p>
        ) : !allSubmitted && !instructionsAcknowledged ? (
          <Reveal><InterviewInstructions onContinue={() => setInstructionsAcknowledged(true)} /></Reveal>
        ) : !allSubmitted && !deviceCheckPassed ? (
          <Reveal><DeviceCheck onContinue={() => setDeviceCheckPassed(true)} /></Reveal>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {responses.map((r, i) => (
              <Reveal key={r.id} delay={Math.min(i * 0.08, 0.32)}>
                <AnswerRecorder
                  response={r}
                  index={i}
                  total={responses.length}
                  applicantId={profile.id}
                  applicationId={application.id}
                  jobCategory={application.job_postings?.category || ''}
                  usedQuestionIds={responses.map((row) => row.question_id)}
                  onSubmitted={handleSubmitted}
                  onRerolled={handleRerolled}
                />
              </Reveal>
            ))}
            {allSubmitted && <InterviewComplete nav={nav} />}
          </div>
        )}
      </section>
    </div>
  );
}
export default Interview;
