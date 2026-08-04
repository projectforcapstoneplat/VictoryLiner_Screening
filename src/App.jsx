import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient.js';
import { getProfile } from './lib/auth.js';
import { Homepage } from './pages/Homepage.jsx';
import { JobFilter } from './pages/JobFilter.jsx';
import { JobDetails } from './pages/JobDetails.jsx';
import { SignIn } from './pages/SignIn.jsx';
import { CreateAccount } from './pages/CreateAccount.jsx';
import { ApplicationForm } from './pages/ApplicationForm.jsx';
import { HrLogin } from './pages/HrLogin.jsx';
import { HrDashboard } from './pages/HrDashboard.jsx';
import { JobPostingForm } from './pages/JobPostingForm.jsx';
import { HrAccounts } from './pages/HrAccounts.jsx';
import { HrApplicants } from './pages/HrApplicants.jsx';

const HR_ROLES = ['hr_personnel', 'hr_head'];

export function App() {
  const [screen, setScreen] = useState('home');
  const [job, setJob] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const nav = (s, j) => {
    setScreen(s);
    setJob(j ?? null);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
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

  if (screen === 'filter') return <JobFilter nav={nav} />;
  if (screen === 'details') return <JobDetails job={job} nav={nav} />;
  if (screen === 'signin') return <SignIn job={job} nav={nav} />;
  if (screen === 'create') return <CreateAccount job={job} nav={nav} />;
  if (screen === 'hr-login') return <HrLogin nav={nav} />;

  if (screen === 'apply') {
    if (!session) return <SignIn job={job} nav={nav} />;
    if (!profile) return null;
    return <ApplicationForm job={job} profile={profile} nav={nav} />;
  }

  if (screen === 'hr-dashboard' || screen === 'hr-job-form' || screen === 'hr-accounts' || screen === 'hr-applicants') {
    if (!session) return <HrLogin nav={nav} />;
    if (!profile) return null;
    if (!HR_ROLES.includes(profile.role)) return <HrLogin nav={nav} />;
    if (screen === 'hr-job-form') return <JobPostingForm job={job} profile={profile} nav={nav} />;
    if (screen === 'hr-applicants') return <HrApplicants job={job} nav={nav} />;
    if (screen === 'hr-accounts') {
      if (profile.role !== 'hr_head') return <HrDashboard nav={nav} profile={profile} />;
      return <HrAccounts nav={nav} />;
    }
    return <HrDashboard nav={nav} profile={profile} />;
  }

  return <Homepage nav={nav} session={session} profile={profile} />;
}

export default App;
