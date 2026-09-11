// "My Resume" — the missing piece between filling out the standalone resume
// once (ResumeForm.jsx) and being stuck with it forever: a place to see it
// formatted as an actual document, jump back into editing it, or print/save
// it as a PDF via the browser's own print dialog (no PDF library needed —
// window.print() already offers "Save as PDF" as a destination on every
// major browser/OS). ResumeForm.jsx already fully supports revisiting and
// updating an existing resume (loads it, shows "Update Your Resume"/"Save
// Changes") — it just had no entry point before this page existed.
import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header/Header.jsx';
import { Footer } from '../components/layout/Footer/Footer.jsx';
import { Button } from '../components/core/Button/Button.jsx';
import { getMyResume } from '../lib/applicantResume.js';
import { computeYearsOfExperience } from '../lib/experience.js';

// The printable document deliberately ignores the site's light/dark theme
// and CSS custom properties — a resume that came out mid-grey-on-dark-grey
// because someone happened to have dark mode on would be a broken printout.
// Fixed, print-safe colors instead: near-black text on white, same as any
// document meant to be read on paper regardless of what theme rendered it.
const DOC_BG = '#ffffff';
const DOC_TEXT = '#1a1a1a';
const DOC_MUTED = '#5a5a5a';
const DOC_RULE = '#d8d8d8';
const DOC_ACCENT = '#b3121f';

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
      color: DOC_ACCENT, margin: '0 0 10px', paddingBottom: 6, borderBottom: `1.5px solid ${DOC_RULE}`,
    }}>
      {children}
    </h2>
  );
}

function DocSection({ children, style }) {
  return <div style={{ marginBottom: 22, ...style }}>{children}</div>;
}

export function MyResume({ profile, nav }) {
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    getMyResume(profile.id).then(({ data }) => {
      if (!cancelled) {
        setResume(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const workExperience = (resume?.work_experience || []).filter((e) => e.company || e.position);
  const education = (resume?.education || []).filter((e) => e.school || e.degree);
  const certifications = (resume?.certifications || []).filter((c) => c.title);
  const totalYears = computeYearsOfExperience(workExperience);

  const drivingFacts = [];
  if (resume?.drivers_license_type) {
    const codes = resume.drivers_license_restrictions?.length ? ` (Codes: ${resume.drivers_license_restrictions.join(', ')})` : '';
    drivingFacts.push(`${resume.drivers_license_type} Driver's License${codes}`);
  }
  if (resume?.years_driving_experience != null) drivingFacts.push(`${resume.years_driving_experience} yr${resume.years_driving_experience === 1 ? '' : 's'} driving experience`);
  if (resume?.has_nbi_clearance) drivingFacts.push('Valid NBI/Police Clearance');
  if (resume?.willing_shifting_schedule) drivingFacts.push('Willing to work a shifting schedule');
  if (resume?.has_medical_certificate) drivingFacts.push('Valid Medical/Fitness Certificate');

  const contactLine = [resume?.email, resume?.phone, resume?.current_location].filter(Boolean).join('   ·   ');

  return (
    <div style={{ background: 'var(--surface-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .resume-doc-wrap { padding: 0 !important; margin: 0 !important; box-shadow: none !important; max-width: 100% !important; }
          .resume-doc-page { box-shadow: none !important; border-radius: 0 !important; }
        }
      `}</style>

      <div className="no-print" style={{ padding: '30px 60px 0' }}><Header nav={nav} profile={profile} /></div>

      <section style={{ maxWidth: 900, margin: '60px auto 0', padding: '0 20px' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 'var(--text-3xl)', margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>My Resume</h1>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', opacity: 0.65 }}>What HR and our AI see when matching you to open roles.</p>
          </div>
          {resume?.completed_at && (
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="ghost" size="sm" onClick={() => nav('resume')}>Edit Resume</Button>
              <Button variant="strong" size="sm" onClick={() => window.print()}>Print / Save as PDF</Button>
            </div>
          )}
        </div>

        {loading ? (
          <p className="no-print" style={{ opacity: 0.7 }}>Loading…</p>
        ) : !resume?.completed_at ? (
          <div className="no-print" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', padding: '40px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>You haven&rsquo;t built a resume yet</h2>
            <p style={{ fontSize: 'var(--text-sm)', opacity: 0.7, maxWidth: 420, margin: 0 }}>
              Build it once and we&rsquo;ll compare it against every open position for you.
            </p>
            <Button variant="strong" size="md" onClick={() => nav('resume')}>Build My Resume</Button>
          </div>
        ) : (
          <div className="resume-doc-wrap">
            <div
              className="resume-doc-page"
              style={{
                background: DOC_BG, color: DOC_TEXT, borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)',
                padding: 'clamp(28px, 6vw, 56px)', fontFamily: "'Georgia', 'Times New Roman', serif", lineHeight: 1.5,
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 0.5 }}>{resume.full_name}</div>
                {contactLine && <div style={{ fontSize: 13, color: DOC_MUTED, marginTop: 6 }}>{contactLine}</div>}
              </div>

              {resume.summary && (
                <DocSection>
                  <SectionTitle>Professional Summary</SectionTitle>
                  <p style={{ fontSize: 14, margin: 0 }}>{resume.summary}</p>
                </DocSection>
              )}

              {resume.skills?.length > 0 && (
                <DocSection>
                  <SectionTitle>Skills</SectionTitle>
                  <p style={{ fontSize: 14, margin: 0 }}>{resume.skills.join('   •   ')}</p>
                </DocSection>
              )}

              {workExperience.length > 0 && (
                <DocSection>
                  <SectionTitle>
                    Work Experience{totalYears != null ? ` — ${totalYears} yr${totalYears === 1 ? '' : 's'} total` : ''}
                  </SectionTitle>
                  {workExperience.map((e, i) => (
                    <div key={i} style={{ marginBottom: i === workExperience.length - 1 ? 0 : 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 14.5 }}>{e.position}{e.position && e.company ? ', ' : ''}{e.company}</strong>
                        {(e.startDate || e.endDate) && (
                          <span style={{ fontSize: 12.5, color: DOC_MUTED, whiteSpace: 'nowrap' }}>
                            {formatDate(e.startDate)} – {e.endDate ? formatDate(e.endDate) : 'Present'}
                          </span>
                        )}
                      </div>
                      {e.description && <p style={{ fontSize: 13.5, margin: '4px 0 0' }}>{e.description}</p>}
                    </div>
                  ))}
                </DocSection>
              )}

              {(education.length > 0 || resume.education_level) && (
                <DocSection>
                  <SectionTitle>Education</SectionTitle>
                  {resume.education_level && <p style={{ fontSize: 13.5, margin: '0 0 6px', color: DOC_MUTED }}>{resume.education_level}</p>}
                  {education.map((e, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: i === education.length - 1 ? 0 : 6 }}>
                      <strong style={{ fontSize: 14 }}>{e.degree}{e.degree && e.school ? ', ' : ''}{e.school}</strong>
                      {e.yearGraduated && <span style={{ fontSize: 12.5, color: DOC_MUTED }}>{e.yearGraduated}</span>}
                    </div>
                  ))}
                </DocSection>
              )}

              {certifications.length > 0 && (
                <DocSection>
                  <SectionTitle>Certifications</SectionTitle>
                  {certifications.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: i === certifications.length - 1 ? 0 : 6 }}>
                      <strong style={{ fontSize: 14 }}>{c.title}{c.issuer ? ` — ${c.issuer}` : ''}</strong>
                      {c.year && <span style={{ fontSize: 12.5, color: DOC_MUTED }}>{c.year}</span>}
                    </div>
                  ))}
                </DocSection>
              )}

              {drivingFacts.length > 0 && (
                <DocSection style={{ marginBottom: 0 }}>
                  <SectionTitle>Driving &amp; Work Eligibility</SectionTitle>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
                    {drivingFacts.map((f, i) => <li key={i} style={{ marginBottom: i === drivingFacts.length - 1 ? 0 : 4 }}>{f}</li>)}
                  </ul>
                </DocSection>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="no-print" style={{ marginTop: 60 }}><Footer nav={nav} /></div>
    </div>
  );
}
export default MyResume;
