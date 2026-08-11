// Applicant — record video answers to the 3 questions assigned to this
// application, one at a time, using the browser's camera + mic.
import { useEffect, useRef, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Stepper } from '../components/navigation/Stepper/Stepper.jsx';
import { ensureAssignedResponses, uploadResponseVideo, translateToTaglish, recordAttempt } from '../lib/interview.js';
import { saveRecoveryChunks, loadRecoveryChunks, clearRecoveryChunks } from '../lib/videoRecoveryStore.js';

const READY_SECONDS = 5;
const RECORD_SECONDS = 60;
const MAX_ATTEMPTS = 3;

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <strong style={{ fontSize: 'var(--text-lg)' }}>Check Your Camera &amp; Mic</strong>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', opacity: 0.75 }}>
          Before you start, make sure HR can clearly see and hear you. Face a light source and say something out loud to test your mic.
        </p>
      </div>
      {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-sm)' }}>{error}</div>}
      {stream && (
        <>
          <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', maxWidth: 400, borderRadius: 8, background: '#000' }} />
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}><MicLevelMeter stream={stream} /></div>
            <div style={{ flex: 1, minWidth: 180 }}><LightingMeter videoRef={videoRef} /></div>
          </div>
        </>
      )}
      <div>
        <Button variant="strong" size="sm" onClick={handleContinue} disabled={!stream}>Continue to Questions</Button>
      </div>
    </div>
  );
}

// locked -> countdown -> recording -> preview -> submitted
// The question text stays hidden (and no camera is requested) until the
// applicant clicks Start — so there's no window to read the question and go
// search for an answer before recording. Once revealed, a 5-second "get
// ready" countdown auto-starts recording, which auto-stops after 1 minute.
function AnswerRecorder({ response, index, applicantId, applicationId, onSubmitted }) {
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
  const [recovery, setRecovery] = useState(null);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

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
    };
    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setRecordSecondsLeft(RECORD_SECONDS);
    setMode('recording');

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

  const reRecord = () => {
    if (attemptCount >= MAX_ATTEMPTS) return;
    setRecordedBlob(null);
    beginCountdown();
  };

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
      return;
    }
    clearRecoveryChunks(applicationId, response.question_id);
    setMode('submitted');
    onSubmitted(data);
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
    const { data, error: tError } = await translateToTaglish(response.interview_questions?.question_text || '');
    setTranslating(false);
    if (tError) {
      setTranslateError(tError);
      return;
    }
    setTaglish(data);
    setShowTaglish(true);
  };

  const questionText = response.interview_questions?.question_text;
  const displayedQuestion = showTaglish && taglish ? taglish : questionText;
  const attemptsLeft = MAX_ATTEMPTS - attemptCount;
  const atAttemptLimit = attemptCount >= MAX_ATTEMPTS;

  return (
    <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '20px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>
          Question {index + 1} of 3{revealed && ` — Attempt ${Math.min(attemptCount, MAX_ATTEMPTS)} of ${MAX_ATTEMPTS}`}
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
        <>
          <p style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginTop: 0 }}>{displayedQuestion}</p>
          {translateError && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)', marginBottom: 8 }}>{translateError}</div>}
          {error && <div style={{ color: 'var(--red-700)', fontSize: 'var(--text-xs)', marginBottom: 10 }}>{error}</div>}

          {mode === 'submitted' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--red-700)' }}>✓ Answer submitted</span>
              {atAttemptLimit ? (
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>You've used all {MAX_ATTEMPTS} attempts for this question.</span>
              ) : (
                <Button variant="ghost" size="sm" onClick={reRecord}>Re-record ({attemptsLeft} left)</Button>
              )}
            </div>
          )}

          {(mode === 'countdown' || mode === 'recording') && (
            <div>
              <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', maxWidth: 480, borderRadius: 8, background: '#000' }} />
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                {mode === 'countdown' && (
                  <span style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--action-primary-bg)' }}>
                    Get ready… recording starts in {readySecondsLeft}s
                  </span>
                )}
                {mode === 'recording' && (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--red-700)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red-700)' }} />
                      Recording — {formatTime(recordSecondsLeft)} left
                    </span>
                    <Button variant="strong" size="sm" onClick={stopRecording}>■ Stop</Button>
                  </>
                )}
              </div>
            </div>
          )}

          {mode === 'preview' && recordedBlob && (
            <div>
              <video src={URL.createObjectURL(recordedBlob)} controls style={{ width: '100%', maxWidth: 480, borderRadius: 8, background: '#000' }} />
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="strong" size="sm" onClick={submit} disabled={uploading}>{uploading ? 'Submitting…' : 'Submit Answer'}</Button>
                {atAttemptLimit ? (
                  <span style={{ fontSize: 'var(--text-xs)', opacity: 0.65 }}>You've used all {MAX_ATTEMPTS} attempts — this take is final.</span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={reRecord} disabled={uploading}>Re-record ({attemptsLeft} left)</Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Interview({ application, profile, nav }) {
  const [responses, setResponses] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [deviceCheckPassed, setDeviceCheckPassed] = useState(false);

  useEffect(() => {
    if (!application?.id) return;
    const category = application.job_postings?.category || '';
    ensureAssignedResponses(application, category).then(({ data, error }) => {
      if (error) {
        setLoadError(`Could not load your interview questions: ${error.message || JSON.stringify(error)}`);
        setResponses([]);
        return;
      }
      setResponses(data);
    });
  }, [application]);

  const handleSubmitted = (updated) => {
    setResponses((rs) => rs.map((r) => (r.question_id === updated.question_id ? updated : r)));
  };

  if (!application) {
    return (
      <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
        <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header links={[]} /></div>
        <section style={{ maxWidth: 900, margin: '60px auto', padding: '0 20px' }}>
          <p>No application selected.</p>
          <Button variant="ghost" size="sm" onClick={() => nav('my-applications')}>Back to My Applications</Button>
        </section>
      </div>
    );
  }

  const allSubmitted = responses?.length > 0 && responses.every((r) => r.video_path);

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ padding: '30px 60px 0' }} className="page-header-wrap"><Header links={[]} /></div>
      <section style={{ maxWidth: 900, margin: '60px auto', padding: '0 20px' }}>
        <div onClick={() => nav('my-applications')} style={{ cursor: 'pointer', color: 'var(--text-link)', fontSize: 'var(--text-xs)', textDecoration: 'underline', marginBottom: 20 }}>&larr; Back to My Applications</div>
        <div style={{ marginBottom: 40, padding: '0 40px' }}><Stepper current={3} /></div>
        <h1 style={{ fontWeight: 600, fontSize: 'var(--text-3xl)', margin: '0 0 8px' }}>Video Interview — {application.job_postings?.title}</h1>
        <p style={{ fontSize: 'var(--text-sm)', opacity: 0.8, marginBottom: 30 }}>
          Each question stays hidden until you click Start. You'll get 5 seconds to prepare, then 1 minute to answer — you can re-record up to {MAX_ATTEMPTS} times per question, before or after submitting.
        </p>

        {loadError && <p style={{ color: 'var(--red-700)' }}>{loadError}</p>}

        {responses === null ? (
          <p>Loading your questions…</p>
        ) : responses.length === 0 ? (
          <p>Interview questions haven't been set up for this role's category yet — check back later.</p>
        ) : !allSubmitted && !deviceCheckPassed ? (
          <DeviceCheck onContinue={() => setDeviceCheckPassed(true)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {responses.map((r, i) => (
              <AnswerRecorder
                key={r.id}
                response={r}
                index={i}
                applicantId={profile.id}
                applicationId={application.id}
                onSubmitted={handleSubmitted}
              />
            ))}
            {allSubmitted && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--red-700)' }}>All questions answered — HR will review your interview along with your application.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
export default Interview;
