import { Leaf, Moon, Sprout, Sun } from 'lucide-react';
import './workshop.css';

export function WorkshopArt({ compact = false }: { compact?: boolean }) {
  return (
    <figure
      className={`workshop-art${compact ? ' workshop-art--compact' : ''}`}
      aria-label="Illustrated game prototype: woodland cards, a game board, wooden pieces, and version notes"
    >
      <div data-layout="illustratedTabletop" className="workshop-art__table">
        <div data-layout="illustratedBoard" className="workshop-art__board" aria-hidden="true">
          <span className="workshop-art__board-label">THE LITTLE WOODLAND</span>
          <svg viewBox="0 0 400 280" fill="none">
            <path
              d="M45 220C40 140 175 250 170 155S300 210 285 110 360 70 355 35"
              stroke="#e5cf94"
              strokeWidth="27"
              strokeLinecap="round"
            />
            <path
              d="M45 220C40 140 175 250 170 155S300 210 285 110 360 70 355 35"
              stroke="#a39368"
              strokeWidth="1.5"
              strokeDasharray="3 18"
            />
            {[
              [65, 70],
              [102, 100],
              [225, 77],
              [318, 228],
              [350, 165],
              [50, 145],
            ].map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${y})`}>
                <path d="M0 -22 -14 5H-7L-17 20H17L7 5H14Z" fill={i % 2 ? '#608e69' : '#91a577'} />
                <path d="M0 18V28" stroke="#c3a47a" strokeWidth="4" />
              </g>
            ))}
            <circle cx="45" cy="220" r="13" fill="#dca35f" stroke="#f1d8a6" strokeWidth="4" />
            <circle cx="355" cy="35" r="13" fill="#b9c586" stroke="#f1d8a6" strokeWidth="4" />
          </svg>
          <span className="workshop-art__pawn workshop-art__pawn--amber" />
          <span className="workshop-art__pawn workshop-art__pawn--sage" />
        </div>
        <div data-layout="illustratedPrototypeCards" className="workshop-art__cards" aria-hidden="true">
          <div data-layout="illustratedMoonCard" className="workshop-art__card workshop-art__card--back">
            <Moon size={36} />
            <span>MOONLIT PATH</span>
          </div>
          <div data-layout="illustratedSunCard" className="workshop-art__card workshop-art__card--middle">
            <Sun size={46} />
            <span>A LITTLE SUNSHINE</span>
          </div>
          <div data-layout="illustratedFernCard" className="workshop-art__card workshop-art__card--front">
            <span className="workshop-art__card-cost">02</span>
            <Sprout size={68} strokeWidth={1.2} />
            <strong>Wild fern</strong>
            <span>
              A small discovery.
              <br />A new possibility.
            </span>
            <i>WOODLAND · DISCOVERY</i>
          </div>
        </div>
        <div data-layout="illustratedVersionNote" className="workshop-art__note" aria-hidden="true">
          <span>notes from the table</span>
          <strong>What if we tried…</strong>
          <p>
            one more card?
            <br />a shorter turn?
            <br />
            <s>starting over?</s>
          </p>
          <small>
            <Leaf size={13} /> saved as version 3
          </small>
        </div>
        <span className="workshop-art__die" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
      {!compact && <figcaption>Small ideas. Many versions. Your next favorite game.</figcaption>}
    </figure>
  );
}
