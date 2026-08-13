import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient.js';
import { getProfile, signOut } from './lib/auth.js';
import { LoadingScreen } from './components/feedback/LoadingScreen/LoadingScreen.jsx';
import { Homepage } from './pages/Homepage.jsx';
import { JobFilter } from './pages/JobFilter.jsx';
import { JobDetails } from './pages/JobDetails.jsx';
import { FAQ } from './pages/FAQ.jsx';
import { Privacy } from './pages/Privacy.jsx';
import { Terms } from './pages/Terms.jsx';
import { Contact } from './pages/Contact.jsx';
import { SignIn } from './pages/SignIn.jsx';
import { ForgotPassword } from './pages/ForgotPassword.jsx';
import { ResetPassword } from './pages/ResetPassword.jsx';
import { CreateAccount } from './pages/CreateAccount.jsx';
import { ApplicationForm } from './pages/ApplicationForm.jsx';
import { HrLogin } from './pages/HrLogin.jsx';
import { HrDashboard } from './pages/HrDashboard.jsx';
import { HrHeadDashboard } from './pages/HrHeadDashboard.jsx';
import { HrPersonnelDashboard } from './pages/HrPersonnelDashboard.jsx';
import { JobPostingForm } from './pages/JobPostingForm.jsx';
import { HrAccounts } from './pages/HrAccounts.jsx';
import { HrApplicants } from './pages/HrApplicants.jsx';
import { HrApplicantsList } from './pages/HrApplicantsList.jsx';
import { InterviewQuestions } from './pages/InterviewQuestions.jsx';
import { MyApplications } from './pages/MyApplications.jsx';
import { Interview } from './pages/Interview.jsx';

const HR_ROLES = ['hr_personnel', 'hr_head'];

// Shown when an HR account (signed in for the HR portal) ends up on an
// applicant-only screen — e.g. clicking "Apply Now" while still signed in
// as HR staff. HR accounts were never meant to apply to jobs as themselves;
// this stops that instead of silently letting them submit an application
// under their own HR identity.
function NotAnApplicant({ nav }) {
  // No sign-out control exists anywhere on the public site for an
  // HR-authenticated session (Homepage's account chip only renders for
  // applicant profiles) — without this, landing here was a dead end: "Back
  // to Careers Site" just re-lands on the same block on every job. Signs
  // out first, then navs (same ordering as HrShell's UserMenu, for the same
  // reason: signOut()'s auth-state-change listener can otherwise race a
  // still-in-flight nav).
  const handleSignOut = () => { nav('signin'); signOut(); };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20, fontFamily: 'var(--font-ui)' }}>
      <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, margin: '0 0 12px' }}>This is an HR account</h1>
          <p style={{ fontSize: 'var(--text-sm)', opacity: 0.75, margin: 0 }}>
            You're signed in with staff credentials, which can't apply to jobs. Sign out and sign in with (or create) an applicant account to continue.
          </p>
        </div>
        <button
          onClick={handleSignOut}
          style={{ background: 'var(--action-primary-bg)', color: '#fff', border: 'none', borderRadius: 999, padding: '12px 28px', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Sign Out & Continue
        </button>
        <button
          onClick={() => nav('home')}
          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', opacity: 0.6, fontSize: 'var(--text-xs)', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          Back to Careers Site (stay signed in as HR)
        </button>
      </div>
    </div>
  );
}

// The Homepage footer no longer shows an "HR Login" link (applicants were
// clicking it out of curiosity) — HR staff instead bookmark this URL to get
// straight to the login screen. Only read once, on first load.
//
// `?screen=` covers the handful of standalone pages that take no props
// (job/session/application) — safe to deep-link into directly, e.g. opening
// Terms in a new tab from the Create Account consent checkbox without
// losing whatever the applicant's already filled in on the original tab.
const DEEP_LINKABLE_SCREENS = ['terms', 'privacy', 'faq', 'contact'];
const getInitialScreen = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('hr') === '1') return 'hr-login';
  const requested = params.get('screen');
  if (DEEP_LINKABLE_SCREENS.includes(requested)) return requested;
  return 'home';
};

export function App() {
  const [screen, setScreen] = useState(getInitialScreen);
  const [job, setJob] = useState(null);
  const [session, setSession] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profile, setProfile] = useState(null);
  const [scrollTarget, setScrollTarget] = useState(null);

  // Third arg is optional: { scrollTo: 'sectionId' } lets a link on any page
  // (e.g. Header's "About Us") land on the homepage already scrolled to a
  // section, instead of just resetting to the top like every other nav does.
  const nav = (s, j, opts) => {
    setScreen(s);
    setJob(j ?? null);
    setScrollTarget(opts?.scrollTo ?? null);
    window.scrollTo(0, 0);
    // getInitialScreen() only ever reads ?hr=1 / ?screen= once, on the very
    // first page load — the URL bar otherwise never reflects in-app
    // navigation (no router here). Without this, the query string would
    // linger forever after leaving the screen it pointed to, so refreshing
    // later would silently bounce back into HR mode (or a deep-linked page)
    // even though the visible screen has long since moved on.
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // Fired when the applicant lands back here via a password-reset email
      // link — Supabase has already verified the token and started a
      // recovery session by this point, so just route to the set-new-
      // password screen instead of treating it as a normal sign-in.
      if (event === 'PASSWORD_RECOVERY') {
        setScreen('reset-password');
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    getProfile(session.user.id).then(({ data }) => setProfile(data));
  }, [session]);

  // Covers the one true "opening the website" gap — the very first paint,
  // before we know whether there's a session at all. Never re-shown after.
  if (!sessionChecked) return <LoadingScreen />;

  if (screen === 'filter') return <JobFilter nav={nav} />;
  if (screen === 'details') return <JobDetails job={job} nav={nav} />;
  if (screen === 'faq') return <FAQ nav={nav} />;
  if (screen === 'privacy') return <Privacy nav={nav} />;
  if (screen === 'terms') return <Terms nav={nav} />;
  if (screen === 'contact') return <Contact nav={nav} />;
  if (screen === 'signin') return <SignIn job={job} nav={nav} />;
  if (screen === 'forgot-password') return <ForgotPassword nav={nav} />;
  if (screen === 'hr-forgot-password') return <ForgotPassword nav={nav} variant="hr" />;
  if (screen === 'reset-password') return <ResetPassword nav={nav} />;
  if (screen === 'create') return <CreateAccount job={job} nav={nav} />;
  if (screen === 'hr-login') return <HrLogin nav={nav} />;

  if (screen === 'apply') {
    if (!session) return <SignIn job={job} nav={nav} />;
    if (!profile) return <LoadingScreen />;
    if (profile.role !== 'applicant') return <NotAnApplicant nav={nav} />;
    return <ApplicationForm job={job} profile={profile} nav={nav} />;
  }

  if (screen === 'my-applications' || screen === 'interview') {
    // No job passed to SignIn here (unlike the 'apply' flow) — job holds an
    // application object on this branch, and SignIn's post-login redirect
    // assumes any job it's given belongs in the apply flow. redirectTo sends
    // them back to My Applications instead of the homepage once signed in.
    if (!session) return <SignIn nav={nav} redirectTo="my-applications" />;
    if (!profile) return <LoadingScreen />;
    if (profile.role !== 'applicant') return <NotAnApplicant nav={nav} />;
    if (screen === 'interview') return <Interview application={job} profile={profile} nav={nav} />;
    return <MyApplications profile={profile} nav={nav} />;
  }

  if (screen === 'hr-dashboard' || screen === 'hr-jobs' || screen === 'hr-job-form' || screen === 'hr-accounts' || screen === 'hr-applicants' || screen === 'hr-applicant-list' || screen === 'interview-questions') {
    if (!session) return <HrLogin nav={nav} />;
    if (!profile) return <LoadingScreen />;
    if (!HR_ROLES.includes(profile.role)) return <HrLogin nav={nav} />;
    if (screen === 'hr-job-form') return <JobPostingForm job={job} profile={profile} nav={nav} />;
    if (screen === 'hr-applicants') return <HrApplicants job={job} nav={nav} profile={profile} />;
    if (screen === 'hr-applicant-list') return <HrApplicantsList nav={nav} profile={profile} />;
    if (screen === 'interview-questions') return <InterviewQuestions profile={profile} nav={nav} />;
    if (screen === 'hr-jobs') return <HrDashboard nav={nav} profile={profile} />;
    if (screen === 'hr-accounts') {
      if (profile.role !== 'hr_head') return <HrDashboard nav={nav} profile={profile} />;
      return <HrAccounts nav={nav} profile={profile} />;
    }
    // 'hr-dashboard' — HR Head lands on the reporting/oversight view (see
    // HrHeadDashboard.jsx, no advance/decline actions); HR Personnel lands on
    // the operational screening-queue dashboard (see HrPersonnelDashboard.jsx).
    if (profile.role === 'hr_head') return <HrHeadDashboard nav={nav} profile={profile} />;
    return <HrPersonnelDashboard nav={nav} profile={profile} />;
  }

  // An HR account browsing the public site is never "the applicant" here —
  // without this, Homepage's account chip would show HR staff's own name/
  // sign-out on the page meant for job applicants (see AccountChip in
  // Homepage.jsx, which only checks `profile ? ... : null`, not the role).
  return <Homepage nav={nav} session={session} profile={profile?.role === 'applicant' ? profile : null} scrollTarget={scrollTarget} />;
}

export default App;
