// Careers homepage.
import { useEffect, useMemo, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { Reveal } from '../components/motion/Reveal/Reveal.jsx';
import { CategoryIcon } from '../components/icons/CategoryIcon.jsx';
import { listPublishedJobs } from '../lib/jobs.js';
import { useInView } from '../lib/useInView.js';
import { useCountUp } from '../lib/useCountUp.js';
import { listJobCategories } from '../lib/jobCategories.js';
import heroBase from '../assets/hero-bus-base.jpg';
import searchIconOutline from '../assets/search-icon-outline.svg';

const STEP_ICON_PROPS = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };

const PROCESS_STEPS = [
  {
    title: 'Submit Application & Resume', description: 'Fill out your profile and structured resume through our secure online portal.',
    icon: <svg {...STEP_ICON_PROPS}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>,
  },
  {
    title: 'Complete Your Video Interview', description: 'Record short video answers to a few screening questions, whenever suits you.',
    icon: <svg {...STEP_ICON_PROPS}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3" /></svg>,
  },
  {
    title: 'Get Contacted for Onboarding', description: 'Our HR team reviews your results and reaches out with next steps.',
    icon: <svg {...STEP_ICON_PROPS}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L8 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.8 2.2z" /></svg>,
  },
];

const FEATURES = [
  { title: 'Fully Online Process', description: 'Apply and interview end-to-end from your phone or computer.' },
  { title: 'No Terminal Visit Required', description: 'Complete the entire initial screening remotely, at your own pace.' },
  { title: 'Pick Up Where You Left Off', description: 'Come back anytime — your application and interview progress are saved.' },
];

const ABOUT_ICON_PROPS = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--action-primary-bg)', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };

const ABOUT_POINTS = [
  {
    title: 'A Household Name in Luzon', description: 'One of the most recognized provincial bus operators in the Philippines, carrying passengers across Central and Northern Luzon and in and out of Metro Manila every day.',
    icon: <svg {...ABOUT_ICON_PROPS}><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /><circle cx="12" cy="12" r="9" /></svg>,
  },
  {
    title: 'Built By The People Who Drive It', description: 'Behind every route is a team of drivers, conductors, terminal staff, and mechanics — the people this careers site exists to hire and support.',
    icon: <svg {...ABOUT_ICON_PROPS}><circle cx="9" cy="8" r="3.4" /><path d="M2.5 20c1-3.6 3.6-5.6 6.5-5.6s5.5 2 6.5 5.6" /><circle cx="18" cy="9" r="2.6" /><path d="M15 20c.6-2.4 2-3.9 3-3.9" /></svg>,
  },
  {
    title: 'Growing, One Hire at a Time', description: 'From new drivers to terminal operations and support roles, we\'re always looking for people who take pride in getting others where they need to go.',
    icon: <svg {...ABOUT_ICON_PROPS}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>,
  },
];

function StepIcon({ number, icon }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%', background: 'var(--action-primary-bg)', color: 'var(--off-white-300)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative',
    }}>
      {icon}
      <span style={{
        position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: '50%',
        background: 'var(--surface-card)', color: 'var(--action-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, boxShadow: '0 0 0 2px var(--surface-card)',
      }}>
        {number}
      </span>
    </div>
  );
}

function ProcessCard({ index, title, description, icon }) {
  return (
    <Reveal
      delay={index * 0.12}
      className="hover-lift"
      style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <StepIcon number={index + 1} icon={icon} />
      <strong style={{ fontSize: 'var(--text-lg)' }}>{title}</strong>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.75, lineHeight: 1.5 }}>{description}</p>
    </Reveal>
  );
}

function FeatureItem({ index, title, description }) {
  return (
    <Reveal delay={index * 0.12} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '0 20px' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--action-primary-bg)' }} />
      </div>
      <strong style={{ fontSize: 'var(--text-md)' }}>{title}</strong>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.7 }}>{description}</p>
    </Reveal>
  );
}

// Replaces the search + job grid for a signed-in applicant (who by
// definition already has a completed resume — see App.jsx's gate) — rather
// than making them browse and self-assess fit against every posting, this
// is the entry point into the AI matching flow (JobMatches.jsx), which they
// now trigger on demand instead of it running automatically for them.
function MatchMeCard({ nav }) {
  return (
    <Reveal className="hover-lift" style={{
      background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)',
      padding: '56px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l2.6 6.6L21 9.3l-5 4.5 1.4 7.2L12 17.5 6.6 21l1.4-7.2-5-4.5 6.4-.7z" />
        </svg>
      </div>
      <div>
        <strong style={{ fontSize: 'var(--text-lg)', display: 'block', marginBottom: 6 }}>Skip the browsing</strong>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.7, maxWidth: 420 }}>
          Your resume's already on file — let our AI compare it against every open position and show you which ones actually fit.
        </p>
      </div>
      <Button variant="strong" size="md" onClick={() => nav('matches')}>Match Me to a Job</Button>
    </Reveal>
  );
}

function OpenRoleCard({ index, job, onView }) {
  return (
    <Reveal
      delay={index * 0.1}
      className="hover-lift"
      style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div className="job-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <CategoryIcon category={job.category} />
          <strong className="job-card-title" style={{ fontSize: 'var(--text-lg)' }}>{job.title}</strong>
        </div>
        {job.employment_type && (
          <span style={{ fontSize: 'var(--text-xs)', padding: '4px 12px', borderRadius: 999, background: 'var(--pink-100)', color: 'var(--red-700)', whiteSpace: 'nowrap' }}>
            {job.employment_type}
          </span>
        )}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', opacity: 0.7 }}>{[job.category, job.location].filter(Boolean).join(' · ')}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Button variant="strong" size="sm" onClick={onView} style={{ flex: 1 }}>View Details</Button>
      </div>
    </Reveal>
  );
}

const STAT_ICON_PROPS = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--action-primary-bg)', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };

function StatTile({ value, suffix = '', label, icon, trigger, delay }) {
  const display = useCountUp(value, trigger);
  return (
    <div className={['reveal', trigger ? 'reveal-visible' : ''].filter(Boolean).join(' ')} style={{ textAlign: 'center', transitionDelay: `${delay}s` }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        {icon}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-6xl)', color: 'var(--action-primary-bg)' }}>
        {display}{suffix}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', opacity: 0.75 }}>{label}</p>
    </div>
  );
}

function StatsStrip({ openPositions, jobsLoaded }) {
  const [ref, inView] = useInView({ threshold: 0.3 });
  // useCountUp fires exactly once (see useCountUp.js) — gating on jobsLoaded
  // too (not just inView) means it can't fire prematurely with `value=0`
  // before the async job fetch resolves and then get stuck there forever
  // once the real count arrives, the same bug this exact pattern caused in
  // JobFilter's result count earlier.
  const trigger = inView && jobsLoaded;
  const stats = [
    { value: openPositions, suffix: '+', label: 'Open Positions Right Now', icon: <svg {...STAT_ICON_PROPS}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> },
    { value: 3, suffix: '', label: 'Simple Steps to Apply', icon: <svg {...STAT_ICON_PROPS}><path d="M4 20l4-4 4 4M12 12l4-4 4 4" /><path d="M4 16v4h4M12 8v4h4" /></svg> },
    { value: 100, suffix: '%', label: 'Online — Apply From Anywhere', icon: <svg {...STAT_ICON_PROPS}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg> },
  ];
  return (
    <section ref={ref} style={{ maxWidth: 1066, margin: '70px auto 0', padding: '0 20px' }}>
      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '40px 20px' }}>
        {stats.map((s, i) => <StatTile key={s.label} {...s} trigger={trigger} delay={i * 0.1} />)}
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="about" style={{ maxWidth: 1066, margin: '90px auto 0', padding: '0 20px' }}>
      <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 44px' }}>
        <Reveal as="h2" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-4xl)', margin: '0 0 14px' }}>About Victory Liner</Reveal>
        <Reveal as="p" delay={0.08} style={{ fontSize: 'var(--text-md)', opacity: 0.75, margin: 0, lineHeight: 1.6 }}>
          Connecting Filipino communities, one journey at a time — and now hiring the people who make every trip possible.
        </Reveal>
      </div>
      <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {ABOUT_POINTS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.12} className="hover-lift" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '30px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.icon}</div>
            <strong style={{ fontSize: 'var(--text-md)' }}>{p.title}</strong>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.75, lineHeight: 1.55 }}>{p.description}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// Continuously auto-scrolling strip of every job category — the list is
// duplicated back-to-back and the track animates exactly -50% so the loop is
// seamless. Gives the page a bit of motion that doesn't depend on the user
// scrolling or hovering anything, which a static category list wouldn't.
function CategoryMarquee({ categories }) {
  if (categories.length === 0) return null;
  const items = [...categories, ...categories];
  return (
    <section style={{ margin: '70px 0 0', padding: '28px 0', background: 'var(--surface-card)', boxShadow: 'var(--shadow-hairline)' }}>
      <div className="marquee-row" style={{ overflow: 'hidden' }}>
        <div className="marquee-track" style={{ display: 'flex', gap: 40, width: 'max-content' }}>
          {items.map((c, i) => (
            <div key={`${c}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', fontSize: 'var(--text-sm)', fontWeight: 600, opacity: 0.8 }}>
              <CategoryIcon category={c} style={{ width: 28, height: 28 }} />
              {c}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Homepage({ nav, profile, scrollTarget }) {
  const [jobs, setJobs] = useState([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    listPublishedJobs().then(({ data }) => {
      setJobs(data);
      setJobsLoaded(true);
    });
    listJobCategories().then(({ data }) => setCategories(data.map((c) => c.name)));
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 30);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollPct(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => j.title.toLowerCase().includes(q) || j.category?.toLowerCase().includes(q));
  }, [jobs, search]);
  const displayedJobs = filteredJobs.slice(0, 4);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  // Lets Header's "About Us" link (used from any page, via nav('home', null,
  // { scrollTo: 'about' })) land here already scrolled to the section,
  // instead of just resetting to the top like a normal nav.
  useEffect(() => {
    if (!scrollTarget) return;
    const id = setTimeout(() => scrollTo(scrollTarget), 80);
    return () => clearTimeout(id);
  }, [scrollTarget]);

  const [connectorRef, connectorInView] = useInView({ threshold: 0.4 });

  // "Apply Now" used to just point at the same full listing as "Open Roles"
  // — a generic browse-it-yourself CTA that no longer matches how applying
  // actually works here. It's now the same "Match Me to a Job" action the
  // homepage's own Explore Open Positions section leads with, so the navbar
  // and the page content say the same thing. "Open Roles" stays as the
  // manual-browse alternative (full transparency of every posting, not just
  // ones that scored well) — renamed so the two aren't easily confused for
  // the same action.
  const navLinks = [
    { label: 'Browse All Roles', onClick: () => nav('filter') },
    { label: 'How It Works', onClick: () => scrollTo('process') },
    { label: 'Track Application', onClick: () => nav('my-applications') },
    { label: 'About Us', onClick: () => scrollTo('about') },
    { label: 'Match Me to a Job', onClick: () => nav('matches'), strong: true },
  ];

  return (
    <div style={{ background: 'var(--surface-page-alt)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, width: `${scrollPct}%`, height: 3, background: 'linear-gradient(90deg, var(--red-700), var(--action-primary-bg))', zIndex: 60, transition: 'width 0.1s linear' }} />
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, boxSizing: 'border-box',
        padding: scrolled ? '14px clamp(16px, 4vw, 60px)' : '30px clamp(16px, 4vw, 60px) 0',
        background: scrolled ? 'var(--surface-page-alt)' : 'transparent',
        boxShadow: scrolled ? '0 6px 18px rgba(0,0,0,0.06)' : 'none',
        transition: 'padding 0.25s ease, background 0.25s ease, box-shadow 0.25s ease',
      }}>
        <Header
          links={navLinks}
          onLogoClick={() => nav('home')}
          compact={scrolled}
          nav={nav}
          profile={profile}
        />
      </div>

      <div style={{ position: 'relative', height: 520, marginTop: 40, overflow: 'hidden' }}>
        <img src={heroBase} alt="" className="hero-zoom" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(9,9,9,0.75) 0%, rgba(9,9,9,0.5) 50%, rgba(9,9,9,0.15) 100%)' }} />
        <div className="hero-content" style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 640, padding: '0 80px', color: 'var(--off-white-300)' }}>
          <h1 className="hero-title fade-in-up" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-7xl)', lineHeight: 1.15, margin: '0 0 20px' }}>
            Drive Your Career Forward with Victory Liner
          </h1>
          <p className="fade-in-up" style={{ fontSize: 'var(--text-lg)', fontWeight: 300, opacity: 0.9, margin: '0 0 32px', animationDelay: '0.12s' }}>
            Apply and complete your initial interview 100% online — anytime, anywhere.
          </p>
          <div className="fade-in-up" style={{ display: 'flex', gap: 16, animationDelay: '0.24s' }}>
            <Button variant="strong" size="md" onClick={() => nav('filter')}>View Open Positions</Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => scrollTo('process')}
              style={{ background: 'rgba(255,255,255,0.12)', color: 'var(--off-white-300)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5)' }}
            >
              How It Works
            </Button>
          </div>
        </div>

        {/* Floating trust badge — small bit of motion/depth over the hero photo itself, not just text fading in. */}
        <div className="fade-in-up float-badge hero-trust-badge" style={{
          animationDelay: '0.4s', position: 'absolute', right: 60, bottom: 56, zIndex: 1,
          background: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: '16px 22px',
          display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--pink-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--action-primary-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div>
            {/* This card is a fixed white "photo overlay" regardless of site theme
                (matching the badge's own always-white background below), so its
                text must be a fixed dark color too — var(--text-primary) would
                flip to near-white in dark mode and vanish against this card. */}
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#1a1a1a' }}>100% Online Screening</div>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.65, color: '#1a1a1a' }}>No terminal visit needed</div>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          onClick={() => scrollTo('process')}
          className="scroll-chevron"
          style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 1, cursor: 'pointer' }}
          aria-hidden="true"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </div>
      </div>

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="bg-blob" aria-hidden="true" style={{ position: 'absolute', top: -80, left: -140, width: 380, height: 380, borderRadius: '50%', background: 'var(--surface-blob)', filter: 'blur(90px)', opacity: 0.7, zIndex: 0 }} />

        <StatsStrip openPositions={jobs.length} jobsLoaded={jobsLoaded} />

        <section id="process" style={{ maxWidth: 1066, margin: '90px auto 0', padding: '0 20px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <Reveal as="h2" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-4xl)', margin: '0 0 10px' }}>Seamless Hiring Process</Reveal>
          <Reveal as="p" delay={0.08} style={{ fontSize: 'var(--text-md)', opacity: 0.7, margin: '0 0 40px' }}>Get started on your new career path in three easy steps.</Reveal>
          <div ref={connectorRef} style={{ position: 'relative' }}>
            <div className={['process-connector', connectorInView ? 'process-connector-visible' : ''].filter(Boolean).join(' ')} />
            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, textAlign: 'left', position: 'relative' }}>
              {PROCESS_STEPS.map((s, i) => <ProcessCard key={s.title} index={i} title={s.title} description={s.description} icon={s.icon} />)}
            </div>
          </div>
        </section>
      </div>

      <CategoryMarquee categories={categories} />

      <section style={{ maxWidth: 1066, margin: '90px auto 0', padding: '0 20px' }}>
        {profile ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              <Reveal as="h2" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-4xl)', margin: '0 0 8px' }}>Explore Open Positions</Reveal>
              <Reveal as="p" delay={0.08} style={{ fontSize: 'var(--text-md)', opacity: 0.7, margin: 0 }}>No need to browse — we'll find the roles that fit you.</Reveal>
            </div>
            <MatchMeCard nav={nav} />
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 30 }}>
              <div>
                <Reveal as="h2" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-4xl)', margin: '0 0 8px' }}>Explore Open Positions</Reveal>
                <Reveal as="p" delay={0.08} style={{ fontSize: 'var(--text-md)', opacity: 0.7, margin: 0 }}>Find a role that fits your skills and ambition.</Reveal>
              </div>
              <div style={{ background: 'var(--surface-search)', borderRadius: 'var(--radius-2xl)', height: 56, minWidth: 280, display: 'flex', alignItems: 'center', padding: '0 20px', boxShadow: 'var(--shadow-hairline)' }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search job title or category"
                  style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)' }}
                />
                <img src={searchIconOutline} alt="" style={{ width: 20, opacity: 0.7 }} />
              </div>
            </div>
            {displayedJobs.length === 0 ? (
              <p style={{ opacity: 0.7 }}>No open positions match your search right now.</p>
            ) : (
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                {displayedJobs.map((j, i) => (
                  <OpenRoleCard key={j.id} index={i} job={j} onView={() => nav('details', j)} />
                ))}
              </div>
            )}
            <div style={{ marginTop: 30, textAlign: 'center' }}>
              <Button variant="ghost" size="sm" onClick={() => nav('filter')}>View All Open Positions</Button>
            </div>
          </>
        )}
      </section>

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="bg-blob" aria-hidden="true" style={{ position: 'absolute', top: 40, right: -160, width: 420, height: 420, borderRadius: '50%', background: 'var(--surface-blob)', filter: 'blur(100px)', opacity: 0.6, zIndex: 0, animationDelay: '3s' }} />

        <section style={{ maxWidth: 1066, margin: '90px auto 0', padding: '40px 20px', background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', position: 'relative', zIndex: 1 }}>
          <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {FEATURES.map((f, i) => <FeatureItem key={f.title} index={i} title={f.title} description={f.description} />)}
          </div>
        </section>

        <div style={{ position: 'relative', zIndex: 1 }}><AboutSection /></div>
      </div>

      <div style={{ marginTop: 90 }}>
        <Footer nav={nav} />
      </div>
    </div>
  );
}
export default Homepage;
