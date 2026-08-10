// Wraps content so it fades/slides in the first time it scrolls into view,
// instead of animating immediately on page load (which meant anything below
// the fold had already "finished" animating before the user ever saw it).
import { useInView } from '../../../lib/useInView.js';

export function Reveal({ children, delay = 0, className = '', style, as: Tag = 'div' }) {
  const [ref, inView] = useInView();
  return (
    <Tag
      ref={ref}
      className={['reveal', inView ? 'reveal-visible' : '', className].filter(Boolean).join(' ')}
      style={{ transitionDelay: `${delay}s`, ...style }}
    >
      {children}
    </Tag>
  );
}
export default Reveal;
