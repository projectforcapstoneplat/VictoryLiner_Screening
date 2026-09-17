// Applicant — record video answers to the questions assigned to this
// application (count is HR Head-configurable, see screening_settings), one
// at a time, using the browser's camera + mic.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { ConfirmModal } from '../components/core/ConfirmModal/ConfirmModal.jsx';
import { Stepper } from '../components/navigation/Stepper/Stepper.jsx';
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';
import { ensureAssignedResponses, uploadResponseVideo, translateToTaglish, recordAttempt, justCompletedInterview } from '../lib/interview.js';
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
// before starting, not just that a device is plugged in. `onConfirmed`
// fires (once) the first time the level actually registers real sound —
// DeviceCheck latches that instead of re-checking the instantaneous level
// at the moment "Continue" is clicked, since a silent moment between words
// shouldn't re-lock a mic that's demonstrably working.
function MicLevelMeter({ stream, onConfirmed }) {
  const [level, setLevel] = useState(0);
  // The live bar alone drops back to ~0 the instant you stop talking, which
  // never actually answers "how loud can my mic get" — only the loudest
  // instant, mid-sentence, would. This tracks the loudest level seen so far
  // and never comes back down (until the check re-mounts), shown as both a
  // number and a marker line on the bar itself, layered over the live level
  // that keeps moving underneath it.
  const [peakLevel, setPeakLevel] = useState(0);
  const confirmedRef = useRef(false);

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
      const nextLevel = Math.min(100, Math.round((avg / 160) * 100));
      setLevel(nextLevel);
      setPeakLevel((p) => Math.max(p, nextLevel));
      if (nextLevel > 8 && !confirmedRef.current) {
        confirmedRef.current = true;
        onConfirmed?.();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      ctx.close();
    };
  }, [stream, onConfirmed]);

  const good = level > 8;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Microphone</span>
        {peakLevel > 0 && <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>Peak: {peakLevel}%</span>}
      </div>
      <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-page-alt)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${level}%`, background: good ? '#1a7f37' : 'var(--gray-400)', transition: 'width 0.1s linear' }} />
        {peakLevel > 0 && (
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${peakLevel}%`, width: 2, background: 'var(--red-700)', transform: 'translateX(-1px)', transition: 'left 0.15s ease-out' }} />
        )}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7, marginTop: 6, color: good ? '#1a7f37' : 'inherit' }}>
        {confirmedRef.current ? 'Mic is picking up sound ✓' : 'Say something out loud — this bar should move'}
      </div>
    </div>
  );
}

// Samples the live video frame onto a tiny offscreen canvas and averages
// perceived luminance — a real reading of whether the applicant is actually
// visible, not just that a camera is connected. `onStatusChange` reports
// live 'ok'/'dark'/'bright' status up to DeviceCheck, which gates
// "Continue to Questions" on it — unlike the mic check, lighting isn't
// latched once good, since walking out of frame of the light source is a
// real, ongoing way to become unreadable again right up to the moment they
// click through.
function LightingMeter({ videoRef, onStatusChange }) {
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
        const avg = total / (data.length / 4);
        setBrightness(avg);
        onStatusChange?.(avg >= 55 && avg <= 220);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [videoRef, onStatusChange]);

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
// instead of finding out mid-question. "Continue" is genuinely disabled
// until both the lighting and mic checks below actually pass, not just
// once a camera/mic stream exists — a granted permission proves a device is
// plugged in, not that HR will be able to see or hear this person.
//
// `stream` is owned by Interview (the parent), not this component — it's
// the same MediaStream that keeps flowing into every question afterward, so
// "Continue to Questions" doesn't tear anything down and the camera never
// goes dark or re-prompts for permission between here and Question 1.
// `videoRef` is likewise the parent's — handed in so Interview can measure
// this exact element's on-screen position right before it unmounts, which
// is what lets the first question's camera animate in from wherever this
// one was instead of just popping into place.
function DeviceCheck({ stream, error, videoRef, onContinue }) {
  const [lightingOk, setLightingOk] = useState(false);
  const [micConfirmed, setMicConfirmed] = useState(false);

  const handleLightingStatus = useCallback((ok) => setLightingOk(ok), []);
  const handleMicConfirmed = useCallback(() => setMicConfirmed(true), []);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream, videoRef]);

  const ready = Boolean(stream) && lightingOk && micConfirmed;

  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: 'clamp(18px, 3vw, 28px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <strong style={{ fontSize: 'var(--text-lg)' }}>Check Your Camera &amp; Mic</strong>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', opacity: 0.75 }}>
          Before you start, make sure HR can clearly see and hear you. Face a light source and say something out loud to test your mic.
        </p>
      </div>
      {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
      {stream && (
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', borderRadius: 8, background: '#000' }} />
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', textAlign: 'left' }}>
            <div style={{ flex: 1, minWidth: 180 }}><MicLevelMeter stream={stream} onConfirmed={handleMicConfirmed} /></div>
            <div style={{ flex: 1, minWidth: 180 }}><LightingMeter videoRef={videoRef} onStatusChange={handleLightingStatus} /></div>
          </div>
        </div>
      )}
      <Button variant="strong" size="sm" onClick={onContinue} disabled={!ready}>Continue to Questions</Button>
      {stream && !ready && (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', opacity: 0.6, textAlign: 'center' }}>
          {!lightingOk && !micConfirmed
            ? "Waiting on good lighting and a mic check — say something out loud and face a light source."
            : !lightingOk
              ? 'Waiting on lighting to look good — face a light source.'
              : 'Waiting on your mic — say something out loud.'}
        </p>
      )}
    </div>
  );
}

// locked -> countdown -> recording -> preview -> submitted
// The question text stays hidden until the applicant clicks Start — so
// there's no window to read the question and go search for an answer before
// recording. The camera itself, though, is visible from the moment the
// device check passes (see `stream`, below) — hiding the *question* is what
// keeps things fair, not hiding the applicant's own live feed. Once
// revealed, a 5-second "get ready" countdown auto-starts recording, which
// auto-stops after 1 minute.
//
// `stream` is Interview's shared MediaStream, not something this component
// requests for itself — the same camera feed carries through every
// question without stopping and re-prompting for permission each time.
// `flipFromRect` (question index 0 only) is the on-screen rect the device
// check's own video occupied the instant before it unmounted — used to
// animate this question's video in from that exact spot instead of it just
// appearing already relocated.
function AnswerRecorder({ response, index, total, applicantId, applicationId, jobCategory, stream, flipFromRect, onSubmitted, onAutoAdvance }) {
  const [mode, setMode] = useState(response.video_path ? 'submitted' : 'locked');
  const [revealed, setRevealed] = useState(!!response.video_path);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [readySecondsLeft, setReadySecondsLeft] = useState(READY_SECONDS);
  const [recordSecondsLeft, setRecordSecondsLeft] = useState(RECORD_SECONDS);
  const [taglish, setTaglish] = useState(null);
  const [showTaglish, setShowTaglish] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState('');
  const [attemptCount, setAttemptCount] = useState(response.attempt_count || 0);
  // True only for the brief window while the attempt count is being
  // persisted server-side, before the countdown/recording UI appears at
  // all — see the comment on beginCountdown for why this has to happen
  // first, not after recording's already started.
  const [startingAttempt, setStartingAttempt] = useState(false);
  const [showLastAttemptConfirm, setShowLastAttemptConfirm] = useState(false);
  const [recovery, setRecovery] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [transcriptAttempted, setTranscriptAttempted] = useState(false);
  const [transcriptErrorCode, setTranscriptErrorCode] = useState('');

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);

  // The bug this guards against: the live-preview <video> (below) only
  // exists in the DOM while mode is locked/countdown/recording — switching
  // to 'preview' swaps in a completely different <video> element (the
  // recorded blob's own playback), and switching back (re-record) mounts a
  // *brand new* live-preview <video> node. A plain `useEffect(..., [stream])`
  // only re-attaches srcObject when the stream itself changes, which it
  // never does here — so that fresh node sat there black, with a live
  // stream flowing but nothing telling this new element to display it,
  // until something else (like the recording finishing) forced a further
  // mode change. attachVideo runs as a ref callback instead, which fires on
  // every mount of this exact node, not just on a dependency change.
  //
  // Wrapped in useCallback — a *new* function reference on every render
  // makes React treat it as a different ref callback each time, which means
  // detaching (calling it with null) and immediately reattaching, even
  // though the underlying DOM node hasn't actually changed. This component
  // re-renders every second (the countdown/recording timers), so an
  // unmemoized version here was tearing the video's srcObject down and
  // reattaching it once a second — the "flickering, gone and back fast"
  // that turned out to be. Memoized on `stream` alone, it now only changes
  // identity if the stream itself ever does, which it doesn't mid-session.
  const attachVideo = useCallback((el) => {
    videoRef.current = el;
    if (el && stream) el.srcObject = stream;
  }, [stream]);

  // FLIP: on mount, if handed the device check's video rect, immediately
  // transform this video to exactly overlap it (no transition yet — this
  // frame should look identical to the one before the handoff), then on the
  // very next frame remove the transform with a transition on, so the
  // browser animates from "sitting where the old video was" to "sitting in
  // its own natural spot" — a real slide, not a fade or a jump cut, without
  // needing the two video elements to ever be the same DOM node.
  useEffect(() => {
    if (!flipFromRect || !videoRef.current) return;
    const el = videoRef.current;
    const apply = () => {
      const newRect = el.getBoundingClientRect();
      if (!newRect.width || !newRect.height) return;
      const dx = flipFromRect.left - newRect.left;
      const dy = flipFromRect.top - newRect.top;
      const scaleX = flipFromRect.width / newRect.width;
      const scaleY = flipFromRect.height / newRect.height;
      el.style.transition = 'none';
      el.style.transformOrigin = 'top left';
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
          el.style.transform = 'none';
        });
      });
    };
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Deliberately doesn't stop the stream's tracks — it's Interview's
      // shared camera feed, kept alive for the next question (or a
      // re-record of this one), not something this take owns exclusively.
      stopSpeechRecognition();
    };
    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setRecordSecondsLeft(RECORD_SECONDS);
    setMode('recording');
    startSpeechRecognition();
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

  // No getUserMedia here anymore — the camera's already live (it's
  // Interview's shared stream, on screen since the device check), so
  // starting a question is just revealing the text and running the
  // countdown, not waiting on a fresh permission grant.
  //
  // The attempt count is written here — awaited, before the countdown or
  // recording ever shows — not inside startRecording after the fact. It
  // used to be a fire-and-forget call made once recording had already
  // begun: someone who deliberately cut the session (closed the tab,
  // killed their connection) quickly enough after clicking Start could
  // interrupt it before that write ever reached the server, while the
  // locally-backed-up recovery chunks were saved regardless. On return,
  // the recovery banner would offer that take back with the server never
  // having counted it — a real way to get more than MAX_ATTEMPTS genuine
  // tries. Waiting on the write first closes that window: by the time any
  // recording (and so any possible interruption of one) can happen, the
  // attempt is already persisted.
  const startAttempt = async () => {
    setError('');
    setStartingAttempt(true);
    const nextAttempt = attemptCount + 1;
    const { error: attemptError } = await recordAttempt(applicationId, response.question_id, nextAttempt);
    setStartingAttempt(false);
    if (attemptError) {
      setError('Could not start this attempt — check your connection and try again.');
      return;
    }
    setAttemptCount(nextAttempt);
    setRevealed(true);
    setReadySecondsLeft(READY_SECONDS);
    setMode('countdown');
  };

  // One warning, right before the take that will actually use up the last
  // attempt — not at submit time (too late to back out of anything by
  // then) and not on every attempt (only this one is irreversible). This
  // take also submits and advances automatically once recorded (see the
  // auto-submit effect below) — there's no re-record option left to decide
  // between afterward, so nothing is gained by making them click Submit
  // manually too. Shown via ConfirmModal, not window.confirm — the native
  // dialog renders as bare, unstyled browser/OS chrome with no way to brand
  // it, in any environment, not just locally.
  const beginCountdown = () => {
    if (!stream) {
      setError('Camera/microphone access was lost. Please refresh and try again.');
      return;
    }
    if (attemptCount >= MAX_ATTEMPTS) return;
    if (attemptCount === MAX_ATTEMPTS - 1) {
      setShowLastAttemptConfirm(true);
      return;
    }
    startAttempt();
  };

  // Re-records this same question — no swap to a different one anymore.
  const reRecord = () => {
    if (attemptCount >= MAX_ATTEMPTS) return;
    setError('');
    setRecordedBlob(null);
    setTaglish(null);
    setShowTaglish(false);
    setLiveTranscript('');
    setTranscriptAttempted(false);
    beginCountdown();
  };

  // Returns whether the upload actually succeeded — the auto-submit effect
  // below needs to know that before it's safe to advance to the next
  // question; advancing away from a *failed* final-attempt upload would
  // abandon it with nothing saved and no way back.
  const submit = async () => {
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
      return false;
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
    return true;
  };

  // The final attempt (warned about up front in beginCountdown) submits and
  // advances on its own — there's no re-record choice left to make once
  // it's recorded, so requiring a manual "Submit Answer" click here would
  // just be an extra tap with no real decision behind it. A short pause
  // first still lets the applicant actually see their own preview land
  // before it's gone, rather than yanking them straight to the next
  // question the instant recording stops. Doesn't advance at all if the
  // upload itself failed — that leaves the normal manual "Submit Answer"
  // button available instead (still rendered below), so a bad connection
  // doesn't strand the take with no way to retry.
  useEffect(() => {
    if (mode !== 'preview' || attemptCount < MAX_ATTEMPTS || !recordedBlob) return;
    const t = setTimeout(() => {
      submit().then((ok) => { if (ok) onAutoAdvance?.(); });
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, attemptCount, recordedBlob]);

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
    <>
      <ConfirmModal
        open={showLastAttemptConfirm}
        title="Last Attempt"
        message={`This is your last attempt for this question (${MAX_ATTEMPTS} of ${MAX_ATTEMPTS}) — once you record it, it submits automatically and you move on to the next question.`}
        confirmLabel="Start Recording"
        cancelLabel="Not Yet"
        onConfirm={() => { setShowLastAttemptConfirm(false); startAttempt(); }}
        onCancel={() => setShowLastAttemptConfirm(false)}
      />
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '16px 24px' }}>
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6, marginBottom: 12 }}>
          Question {index + 1} of {total}
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

      {/* Camera on the left, question + controls on the right — the video
          itself (and this two-column shape) stays constant across locked,
          countdown, recording, and preview; only what's inside each side
          changes with `mode`. That's what makes the camera read as "already
          there" the moment a question becomes current, instead of popping
          in only once Start is clicked. */}
      <div className="fade-in-up" style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 300px', maxWidth: 420, minWidth: 240 }}>
          {(mode === 'locked' || mode === 'countdown' || mode === 'recording') && stream && (
            <div style={{ position: 'relative' }}>
              <video ref={attachVideo} autoPlay muted playsInline style={{ width: '100%', borderRadius: 8, background: '#000', display: 'block' }} />
              {mode === 'countdown' && (
                <div className="fade-in-up" style={{
                  position: 'absolute', inset: 0, borderRadius: 8, background: 'rgba(15,10,10,0.55)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                }}>
                  <CountdownRing secondsLeft={readySecondsLeft} totalSeconds={READY_SECONDS} />
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#fff' }}>Get ready…</span>
                </div>
              )}
              {mode === 'recording' && (
                <>
                  {/* Upper-right overlay badge on the video itself, instead
                      of plain text below it — a recording timer that's easy
                      to skim past under everything else isn't much of a
                      timer; this is the same corner every real video-call
                      app puts one. */}
                  <div style={{
                    position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(15,10,10,0.65)', color: '#fff', padding: '6px 12px', borderRadius: 999,
                    fontSize: 'var(--text-sm)', fontWeight: 700,
                  }}>
                    <span className="recording-dot-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red-700)' }} />
                    {formatTime(recordSecondsLeft)}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Button variant="strong" size="sm" onClick={stopRecording}>■ Stop</Button>
                    </div>
                    <div style={{ marginTop: 8, height: 5, borderRadius: 999, background: 'var(--surface-page-alt)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(recordSecondsLeft / RECORD_SECONDS) * 100}%`, background: 'var(--red-700)', transition: 'width 1s linear' }} />
                    </div>
                    {/* Same live level meter as the device check, now visible
                        while actually answering — so a mic that drifts quiet
                        partway through a take is something the applicant can
                        actually see happening, not just find out about after
                        HR reviews it. */}
                    <div style={{ marginTop: 12 }}>
                      <MicLevelMeter stream={stream} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {mode === 'preview' && recordedBlob && (
            <div>
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
            </div>
          )}

          {mode === 'submitted' && (
            <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 8, background: 'var(--surface-page-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', color: 'var(--red-700)', fontWeight: 700 }}>
              ✓ Answer submitted
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 280px', minWidth: 240 }}>
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
                <Button variant="strong" size="sm" onClick={beginCountdown} disabled={!stream || !!recovery || startingAttempt}>
                  {startingAttempt ? 'Starting…' : 'Start Question'}
                </Button>
              </>
            )
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>Attempt {Math.min(attemptCount, MAX_ATTEMPTS)} of {MAX_ATTEMPTS}</span>
                <Button variant="ghost" size="sm" onClick={handleTranslate} disabled={translating}>
                  {translating ? 'Translating…' : showTaglish ? 'Show Original' : '🌐 Translate to Taglish'}
                </Button>
              </div>
              <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginTop: 0 }}>{displayedQuestion}</p>
              {translateError && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)', marginBottom: 8 }}>{translateError}</div>}
              {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)', marginBottom: 10 }}>{error}</div>}

              {mode === 'submitted' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--red-700)', fontWeight: 700 }}>✓ Submitted</span>
                  {atAttemptLimit ? (
                    <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>You've used all {MAX_ATTEMPTS} attempts for this question.</span>
                  ) : (
                    <Button variant="outline" size="sm" onClick={reRecord}>Re-record ({attemptsLeft} left)</Button>
                  )}
                </div>
              )}

              {mode === 'preview' && recordedBlob && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Button variant="strong" size="sm" onClick={submit} disabled={uploading}>{uploading ? 'Submitting…' : 'Submit Answer'}</Button>
                  {atAttemptLimit ? (
                    <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>
                      {uploading ? 'Submitting your final attempt…' : `Last attempt (${MAX_ATTEMPTS} of ${MAX_ATTEMPTS}) — submitting automatically and moving on…`}
                    </span>
                  ) : (
                    <Button variant="outline" size="sm" onClick={reRecord} disabled={uploading}>Re-record ({attemptsLeft} left)</Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </div>
    </>
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
  // One question shown at a time instead of the whole list at once — starts
  // on whichever question isn't submitted yet, not always question 1, so
  // resuming later (or after a reroll elsewhere) lands somewhere useful
  // instead of back at the beginning every time.
  const [currentIndex, setCurrentIndex] = useState(0);
  const indexInitialized = useRef(false);

  // Owned here, not by DeviceCheck or AnswerRecorder — one camera/mic
  // permission grant for the whole interview, requested once and kept alive
  // through every question, instead of each screen asking again and the
  // feed going dark in between.
  const [stream, setStream] = useState(null);
  const [streamError, setStreamError] = useState('');
  const deviceCheckVideoRef = useRef(null);
  // The device check video's on-screen rect, captured the instant before it
  // unmounts — handed to Question 1's AnswerRecorder so its own video can
  // animate in from there (see the FLIP effect on AnswerRecorder) instead of
  // just appearing already relocated.
  const flipRectRef = useRef(null);

  useEffect(() => {
    if (!instructionsAcknowledged) return;
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((s) => {
        if (active) setStream(s);
        else s.getTracks().forEach((t) => t.stop());
      })
      .catch(() => setStreamError('Could not access your camera/microphone. Check your browser permissions and try again.'));
    return () => {
      active = false;
    };
  }, [instructionsAcknowledged]);

  // Only torn down when the interview session itself ends (component
  // unmounts, e.g. navigating back to My Applications) — not between
  // questions, not on a re-record, which is the entire point of sharing it.
  useEffect(() => {
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);

  const handleDeviceCheckPassed = () => {
    flipRectRef.current = deviceCheckVideoRef.current?.getBoundingClientRect() || null;
    setDeviceCheckPassed(true);
  };

  // Consumed by Question 1's AnswerRecorder the moment it mounts (it reads
  // the prop value, not this ref, so clearing it here doesn't affect that) —
  // cleared right after so navigating back to question 1 later (Previous,
  // or clicking its dot) doesn't replay the same handoff animation from a
  // now-stale device-check position.
  useEffect(() => {
    if (!deviceCheckPassed) return;
    flipRectRef.current = null;
  }, [deviceCheckPassed]);

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

  useEffect(() => {
    if (indexInitialized.current || !responses) return;
    indexInitialized.current = true;
    const firstUnsubmitted = responses.findIndex((r) => !r.video_path);
    setCurrentIndex(firstUnsubmitted === -1 ? 0 : firstUnsubmitted);
  }, [responses]);

  const handleSubmitted = (updated) => {
    setResponses((rs) => {
      const next = rs.map((r) => (r.question_id === updated.question_id ? updated : r));
      if (justCompletedInterview(rs, next)) notifyHrInterviewCompleted(application.id);
      return next;
    });
  };

  const backButton = (
    <button
      onClick={() => nav('my-applications')}
      className="btn-animate"
      style={{
        display: 'flex', alignItems: 'center', gap: 7, width: 'fit-content', margin: '0 auto 12px',
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
        <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header links={[]} nav={nav} /></div>
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
      <div style={{ padding: '16px 60px 0' }} className="page-header-wrap"><Header links={[]} nav={nav} /></div>
      <section style={{ maxWidth: 1000, margin: '20px auto', padding: '0 20px' }}>
        {backButton}
        {/* Mirrors MyApplications.jsx's getStepIndex exactly: still on
            "Video Screening" (index 2) until every question actually has a
            recorded answer, only crossing into "Reviewing" (index 3) once
            allSubmitted — this page had been hardcoded to 3 for the whole
            duration, showing "Reviewing" as already current before the
            applicant had recorded a single answer. */}
        <div style={{ marginBottom: 16, padding: '0 clamp(8px, 4vw, 40px)' }}><Stepper current={allSubmitted ? 3 : 2} /></div>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <h1 style={{ fontWeight: 600, fontSize: 'var(--text-2xl)', margin: '0 0 4px' }}>Video Interview — {application.job_postings?.title}</h1>
          <p style={{ fontSize: 'var(--text-xs)', opacity: 0.7, margin: 0 }}>Take your time — everything you need to know is on the next screen.</p>
        </div>

        {loadError && <p style={{ color: 'var(--red-700)' }}>{loadError}</p>}

        {responses === null ? (
          <p style={{ textAlign: 'center' }}>Loading your questions…</p>
        ) : responses.length === 0 ? (
          <p style={{ textAlign: 'center' }}>Interview questions haven't been set up for this role's category yet — check back later.</p>
        ) : allSubmitted ? (
          <InterviewComplete nav={nav} />
        ) : !instructionsAcknowledged ? (
          <Reveal><InterviewInstructions onContinue={() => setInstructionsAcknowledged(true)} /></Reveal>
        ) : !deviceCheckPassed ? (
          <Reveal><DeviceCheck stream={stream} error={streamError} videoRef={deviceCheckVideoRef} onContinue={handleDeviceCheckPassed} /></Reveal>
        ) : (
          // One question on screen at a time — not the whole list — with a
          // clickable dot per question above it: filled/checked once
          // submitted, the current one outlined, anything further ahead
          // disabled so there's no skipping to a question out of order.
          // "Next Question" itself doesn't even appear until the one on
          // screen right now actually has a submitted answer, same reasoning
          // (not just disabled beforehand — genuinely not there yet).
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              {responses.map((r, i) => {
                const submitted = !!r.video_path;
                const isCurrent = i === currentIndex;
                const reachable = submitted || i <= currentIndex;
                return (
                  <button
                    key={r.id}
                    onClick={() => reachable && setCurrentIndex(i)}
                    disabled={!reachable}
                    aria-label={`Question ${i + 1}${submitted ? ' — submitted' : isCurrent ? ' — current' : ' — not yet reached'}`}
                    className="btn-animate"
                    style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      border: isCurrent ? '2px solid var(--action-primary-bg)' : 'none',
                      background: submitted ? 'var(--action-primary-bg)' : 'var(--surface-card)',
                      boxShadow: submitted ? 'none' : 'var(--shadow-hairline)',
                      color: submitted ? '#fff' : 'var(--text-primary)',
                      fontSize: 'var(--text-xs)', fontWeight: 700, fontFamily: 'inherit',
                      cursor: reachable ? 'pointer' : 'default', opacity: reachable ? 1 : 0.4,
                    }}
                  >
                    {submitted ? '✓' : i + 1}
                  </button>
                );
              })}
            </div>

            <Reveal key={responses[currentIndex].id}>
              <AnswerRecorder
                response={responses[currentIndex]}
                index={currentIndex}
                total={responses.length}
                applicantId={profile.id}
                applicationId={application.id}
                jobCategory={application.job_postings?.category || ''}
                stream={stream}
                flipFromRect={currentIndex === 0 ? flipRectRef.current : null}
                onSubmitted={handleSubmitted}
                onAutoAdvance={() => setCurrentIndex((i) => Math.min(responses.length - 1, i + 1))}
              />
            </Reveal>

            {currentIndex < responses.length - 1 && responses[currentIndex].video_path && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="strong" size="sm"
                  onClick={() => setCurrentIndex((i) => Math.min(responses.length - 1, i + 1))}
                >
                  Next Question →
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
export default Interview;
