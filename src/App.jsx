import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient.js';
import { getProfile } from './lib/auth.js';
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
import { InterviewQuestions } from './pages/InterviewQuestions.jsx';
import { MyApplications } from './pages/MyApplications.jsx';
import { Interview } from './pages/Interview.jsx';

const HR_ROLES = ['hr_personnel', 'hr_head'];

// The Homepage footer no longer shows an "HR Login" link (applicants were
// clicking it out of curiosity) — HR staff instead bookmark this URL to get
// straight to the login screen. Only read once, on first load.
const getInitialScreen = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('hr') === '1' ? 'hr-login' : 'home';
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
  if (screen === 'reset-password') return <ResetPassword nav={nav} />;
  if (screen === 'create') return <CreateAccount job={job} nav={nav} />;
  if (screen === 'hr-login') return <HrLogin nav={nav} />;

  if (screen === 'apply') {
    if (!session) return <SignIn job={job} nav={nav} />;
    if (!profile) return <LoadingScreen />;
    return <ApplicationForm job={job} profile={profile} nav={nav} />;
  }

  if (screen === 'my-applications' || screen === 'interview') {
    // No job passed to SignIn here (unlike the 'apply' flow) — job holds an
    // application object on this branch, and SignIn's post-login redirect
    // assumes any job it's given belongs in the apply flow. redirectTo sends
    // them back to My Applications instead of the homepage once signed in.
    if (!session) return <SignIn nav={nav} redirectTo="my-applications" />;
    if (!profile) return <LoadingScreen />;
    if (screen === 'interview') return <Interview application={job} profile={profile} nav={nav} />;
    return <MyApplications profile={profile} nav={nav} />;
  }

  if (screen === 'hr-dashboard' || screen === 'hr-jobs' || screen === 'hr-job-form' || screen === 'hr-accounts' || screen === 'hr-applicants' || screen === 'interview-questions') {
    if (!session) return <HrLogin nav={nav} />;
    if (!profile) return <LoadingScreen />;
    if (!HR_ROLES.includes(profile.role)) return <HrLogin nav={nav} />;
    if (screen === 'hr-job-form') return <JobPostingForm job={job} profile={profile} nav={nav} />;
    if (screen === 'hr-applicants') return <HrApplicants job={job} nav={nav} profile={profile} />;
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

  return <Homepage nav={nav} session={session} profile={profile} scrollTarget={scrollTarget} />;
}

export default App;
