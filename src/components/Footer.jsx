import { Link } from 'react-router-dom';
import { BrainCircuit } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">

        <div className="footer-brand">
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              className="brand-mark"
              style={{
                width: 28,
                height: 28,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 9,
              }}
            >
              <BrainCircuit
                size={15}
                strokeWidth={2.2}
              />
            </span>

            <span>COGNITA AI</span>
          </span>
        </div>

        <p className="footer-tagline">
          Understand Your Thinking. Improve Your Reasoning.
        </p>

        <p className="footer-sub">
          Mīmāṃsā-inspired cognitive reasoning framework
        </p>

      </div>
    </footer>
  );
}
